# Windows-Island Claude Code Integration Installer
# Run from PowerShell: .\scripts\install.ps1
# Or from repo root:   powershell -ExecutionPolicy Bypass -File scripts\install.ps1

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ErrorActionPreference = 'Stop'
$RepoRoot   = Split-Path $PSScriptRoot -Parent
$ClaudeDir  = Join-Path $env:USERPROFILE '.claude'
$ScriptsDir = Join-Path $ClaudeDir 'scripts'
$SettingsFile = Join-Path $ClaudeDir 'settings.json'
$Username   = $env:USERNAME

Write-Host ""
Write-Host "=== Windows-Island x Claude Code Integration Installer ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Copy scripts ────────────────────────────────────────────────────
Write-Host "[1/3] Copying hook scripts to $ScriptsDir ..." -ForegroundColor Yellow

if (-not (Test-Path $ScriptsDir)) {
    New-Item -ItemType Directory -Path $ScriptsDir -Force | Out-Null
}

Copy-Item "$RepoRoot\scripts\island-notify.ps1"     $ScriptsDir -Force
Copy-Item "$RepoRoot\scripts\island-permission.ps1" $ScriptsDir -Force

Write-Host "      island-notify.ps1     -> $ScriptsDir" -ForegroundColor Green
Write-Host "      island-permission.ps1 -> $ScriptsDir" -ForegroundColor Green

# ── Step 2: Build hooks config ──────────────────────────────────────────────
Write-Host ""
Write-Host "[2/3] Merging hooks into $SettingsFile ..." -ForegroundColor Yellow

$notifyScript    = "$ClaudeDir/scripts/island-notify.ps1"     -replace '\\', '/'
$permScript      = "$ClaudeDir/scripts/island-permission.ps1" -replace '\\', '/'

$newHooks = [ordered]@{
    PreToolUse  = @(
        [ordered]@{
            matcher = "Bash"
            hooks   = @(
                [ordered]@{
                    type    = "command"
                    command = "powershell.exe -NoProfile -File `"$permScript`""
                }
            )
        },
        [ordered]@{
            matcher = "Edit"
            hooks   = @(
                [ordered]@{
                    type    = "command"
                    command = "powershell.exe -NoProfile -File `"$permScript`""
                }
            )
        },
        [ordered]@{
            matcher = "Write"
            hooks   = @(
                [ordered]@{
                    type    = "command"
                    command = "powershell.exe -NoProfile -File `"$permScript`""
                }
            )
        }
    )
    PostToolUse = @(
        [ordered]@{
            matcher = ""
            hooks   = @(
                [ordered]@{
                    type    = "command"
                    command = "powershell.exe -NoProfile -File `"$notifyScript`" -State idle"
                }
            )
        }
    )
    Stop        = @(
        [ordered]@{
            matcher = ""
            hooks   = @(
                [ordered]@{
                    type    = "command"
                    command = "powershell.exe -NoProfile -File `"$notifyScript`" -State idle -ReadStdin"
                }
            )
        }
    )
}

# Read existing settings.json (or create empty object)
$cfg = [ordered]@{}
if (Test-Path $SettingsFile) {
    # Backup first
    $backup = "$SettingsFile.bak"
    Copy-Item $SettingsFile $backup -Force
    Write-Host "      Backed up existing settings.json -> settings.json.bak" -ForegroundColor DarkGray

    $existing = Get-Content $SettingsFile -Raw -Encoding UTF8 | ConvertFrom-Json
    # Convert PSObject to ordered hashtable to preserve other keys
    $existing.PSObject.Properties | ForEach-Object { $cfg[$_.Name] = $_.Value }
}

# Merge hooks
$cfg['hooks'] = $newHooks

# Write back
$cfg | ConvertTo-Json -Depth 20 | Set-Content $SettingsFile -Encoding UTF8
Write-Host "      hooks merged into $SettingsFile" -ForegroundColor Green

# ── Step 3: Summary ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "[3/3] Done!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Integration active hooks:" -ForegroundColor Cyan
Write-Host "  PreToolUse  (Bash/Edit/Write) -> island-permission.ps1"
Write-Host "    Shows Approve / Always Allow / Deny buttons in Windows-Island"
Write-Host "  PostToolUse (all tools)        -> island-notify.ps1 -State idle"
Write-Host "    Notifies Windows-Island when each tool finishes"
Write-Host "  Stop                           -> island-notify.ps1 -State idle -ReadStdin"
Write-Host "    Sends the final AI response to Windows-Island when Claude Code exits"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Launch Windows-Island (npm run tauri dev  OR  run the release build)"
Write-Host "  2. Start a Claude Code session — the AI tab will light up automatically"
Write-Host ""
Write-Host "If hooks don't fire, run in PowerShell as Administrator:" -ForegroundColor DarkYellow
Write-Host "  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser"
Write-Host ""
