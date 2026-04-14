param([string]$Tool = '', [string]$Message = '')

# Read hook input from stdin (provided by Claude Code)
$hookInput = $null
try {
    if (-not [Console]::IsInputRedirected) { $hookInput = $null }
    else {
        $raw = [Console]::In.ReadToEnd()
        if ($raw) { $hookInput = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue }
    }
} catch {}

# Extract tool name and command from hook input if not provided via params
if ($hookInput) {
    if (-not $Tool -and $hookInput.tool_name) { $Tool = $hookInput.tool_name }
    if (-not $Message) {
        $cmd = $hookInput.tool_input.command
        $fp  = $hookInput.tool_input.file_path
        if ($cmd) { $Message = ($cmd | Out-String).Trim().Substring(0, [Math]::Min(100, ($cmd | Out-String).Trim().Length)) }
        elseif ($fp) { $Message = $fp.Substring(0, [Math]::Min(100, $fp.Length)) }
    }
}

# --- Allowed-tool fast-path ---
# Read the project settings to check whether this tool+command is already allowed.
# If it is, Claude Code will auto-approve without showing its own dialog, so we
# should NOT show the Island permission UI — just exit 0 immediately.
$settingsFiles = @(
    (Join-Path $PSScriptRoot '../../settings.json'),          # ~/.claude/settings.json
    (Join-Path (Get-Location) '.claude/settings.local.json'), # project local
    (Join-Path (Get-Location) '.claude/settings.json')        # project global
)

foreach ($sf in $settingsFiles) {
    try {
        $resolved = [System.IO.Path]::GetFullPath($sf)
        if (Test-Path $resolved) {
            $cfg = Get-Content $resolved -Raw | ConvertFrom-Json -ErrorAction SilentlyContinue
            $allowed = $cfg.permissions.allow
            if ($allowed) {
                foreach ($rule in $allowed) {
                    # Rules look like "Bash", "Bash(*)", "Edit", "Bash(npm run:*)", etc.
                    # Only skip Island UI for BROAD rules that allow ALL uses of a tool:
                    #   - Bare tool name: "Bash", "Edit", "Write"
                    #   - Wildcard-all:   "Bash(*)"
                    # Scoped rules like "Bash(npm run:*)" only allow specific commands —
                    # Claude Code handles matching internally, so we must still show the
                    # Island UI for commands that don't match any scoped rule.
                    $trimmed = $rule.Trim()
                    $isBareToolName = ($trimmed -eq $Tool)
                    $isWildcardAll  = ($trimmed -eq "$Tool(*)")
                    if ($isBareToolName -or $isWildcardAll) {
                        exit 0
                    }
            }
        }
    } catch {}
}

# --- Show Island permission UI ---
$responseFile = "$env:TEMP\island-permission-response.txt"
if (Test-Path $responseFile) { Remove-Item $responseFile -Force }

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$cts.CancelAfter(2000)
$connected = $false
try {
    $ws.ConnectAsync([Uri]'ws://127.0.0.1:27182', $cts.Token).Wait()
    $json = @{ state = 'permission_required'; tool = $Tool; message = $Message } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', $cts.Token).Wait()
    $connected = $true
} catch {} finally { $cts.Dispose(); if ($ws) { $ws.Dispose() } }

# Island not running — let Claude Code handle permission itself
if (-not $connected) { exit 0 }

# Poll for user response written by Island's Approve/Deny button
$timeout = 120; $elapsed = 0
while ($elapsed -lt $timeout) {
    if (Test-Path $responseFile) {
        $response = (Get-Content $responseFile -Raw).Trim()
        Remove-Item $responseFile -Force

        if ($response -eq 'approve' -or $response -eq 'cancel') {
            exit 0
        }
        elseif ($response -eq 'always_allow') {
            # Persist the tool to permissions.allow in settings.local.json
            $projectSettings = Join-Path (Get-Location) '.claude/settings.local.json'
            $globalSettings  = Join-Path $env:USERPROFILE '.claude/settings.local.json'

            foreach ($settingsPath in @($projectSettings, $globalSettings)) {
                try {
                    if (Test-Path $settingsPath) {
                        $cfg = Get-Content $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction SilentlyContinue
                    }
                    if (-not $cfg) { $cfg = [PSCustomObject]@{} }

                    if (-not $cfg.permissions) {
                        $cfg | Add-Member -NotePropertyName 'permissions' -NotePropertyValue ([PSCustomObject]@{ allow = @() }) -Force
                    }
                    elseif (-not $cfg.permissions.allow) {
                        $cfg.permissions | Add-Member -NotePropertyName 'allow' -NotePropertyValue @() -Force
                    }

                    $toolRule = if ($Tool) { $Tool } else { 'Bash' }
                    $existingRules = @($cfg.permissions.allow)
                    $alreadyExists = $false
                    foreach ($r in $existingRules) {
                        $rTool = ($r -split '\(')[0].Trim()
                        if ($rTool -eq $toolRule) { $alreadyExists = $true; break }
                    }

                    if (-not $alreadyExists) {
                        $cfg.permissions.allow = @($existingRules) + @($toolRule)
                        $dir = Split-Path $settingsPath -Parent
                        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
                        $cfg | ConvertTo-Json -Depth 10 | Set-Content $settingsPath -Encoding UTF8
                    }
                } catch {}
            }
            exit 0
        }
        else {
            # "deny" or any unknown response -> block
            exit 2
        }
    }
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
}

# Timed out without response -> deny by default
exit 2
