param(
    [string]$State,
    [string]$Tool = "",
    [string]$Message = "",
    [switch]$ReadStdin
)

# Force UTF-8 encoding for correct Chinese/Unicode handling
[Console]::InputEncoding  = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# When -ReadStdin is set (used by Stop hook), read stdin JSON from Claude Code
# and try to extract the last assistant response from the transcript file.
if ($ReadStdin) {
    try {
        if ([Console]::IsInputRedirected) {
            $raw = [Console]::In.ReadToEnd()
            if ($raw) {
                $hookInput = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue

                # Try direct "response" field first (future Claude Code versions may include it)
                if (-not $Message -and $hookInput.response) {
                    $Message = [string]$hookInput.response
                }

                # Fallback: read the last assistant message from transcript JSONL file
                if (-not $Message -and $hookInput.transcript_path -and (Test-Path $hookInput.transcript_path)) {
                    # Use .NET API with explicit UTF-8 encoding instead of Get-Content
                    # to prevent Chinese character corruption
                    $allText = [System.IO.File]::ReadAllText($hookInput.transcript_path, [System.Text.Encoding]::UTF8)
                    $lines = $allText -split "`n" | Where-Object { $_.Trim() } | Select-Object -Last 30
                    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
                        try {
                            $entry = $lines[$i] | ConvertFrom-Json -ErrorAction SilentlyContinue
                            if ($entry.type -eq 'assistant' -and $entry.message -and $entry.message.content) {
                                foreach ($block in $entry.message.content) {
                                    if ($block.type -eq 'text' -and $block.text) {
                                        $Message = $block.text
                                        break
                                    }
                                }
                                if ($Message) { break }
                            }
                        } catch {}
                    }
                }

                # Truncate to avoid oversized WebSocket messages
                if ($Message -and $Message.Length -gt 5000) {
                    $Message = $Message.Substring(0, 5000) + '...'
                }
            }
        }
    } catch {}
}

# Fallback: ensure we always have a message for idle state transitions
# so the panel can expand and show completion status
if ($State -eq 'idle' -and $ReadStdin -and -not $Message) {
    $Message = 'Task completed'
}

$ws = New-Object System.Net.WebSockets.ClientWebSocket
$cts = New-Object System.Threading.CancellationTokenSource
$cts.CancelAfter(3000)

try {
    $ws.ConnectAsync([Uri]"ws://127.0.0.1:27182", $cts.Token).Wait()
    $json = @{ state = $State; tool = $Tool; message = $Message } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "", $cts.Token).Wait()
} catch {
    # Silently ignore - Island may not be running
} finally {
    $cts.Dispose()
    if ($ws) { $ws.Dispose() }
}
