<#
.SYNOPSIS
  Sends a one-shot "check my inbox" task to an already-running OtoClaw daemon.

.DESCRIPTION
  This is NOT a scheduler — it just speaks the daemon's existing WebSocket JSON-RPC protocol
  (packages/shared/src/protocol.ts) to submit a message.send task, the same way the CLI's
  Ink UI does. The daemon runs the task in the background ("submit and forget" — see
  ARCHITECTURE.md / server.ts's runMessage) and keeps working even after this script exits,
  so it's safe to call from any external scheduler (Windows Task Scheduler, cron, etc.) on a
  timer without leaving a process running in between runs.

  Point Windows Task Scheduler's trigger at this script (see apps/extension/README.md,
  section "Periodic inbox checks") to get a "check my inbox every N minutes" behavior without
  a bespoke watcher process.

.PARAMETER Cwd
  Working directory for the session (a project path the daemon has access to). Defaults to
  the current directory.

.PARAMETER Message
  Task text sent to the agent. Defaults to a Turkish "check inbox, draft replies" instruction.

.EXAMPLE
  pwsh -File scripts/watch-inbox.ps1
#>

param(
	[string]$Cwd = (Get-Location).Path,
	[string]$Message = "Gelen kutumu kontrol et, yeni mailler varsa uygun cevap taslakları hazırla. Taslakları asla otomatik gönderme."
)

$daemonJsonPath = Join-Path $HOME ".otoclaw\daemon.json"
if (-not (Test-Path $daemonJsonPath)) {
	Write-Error "OtoClaw daemon is not running (no $daemonJsonPath). Start it first (e.g. 'bun run dev' or the compiled daemon binary)."
	exit 1
}

$daemonInfo = Get-Content $daemonJsonPath -Raw | ConvertFrom-Json
$uri = "ws://127.0.0.1:$($daemonInfo.port)/ws?token=$($daemonInfo.token)"

Add-Type -AssemblyName System.Net.WebSockets.Client -ErrorAction SilentlyContinue

$ws = [System.Net.WebSockets.ClientWebSocket]::new()
$cts = [System.Threading.CancellationTokenSource]::new()
$cts.CancelAfter([TimeSpan]::FromSeconds(15))

function Send-Json($socket, $obj, $token) {
	$json = $obj | ConvertTo-Json -Compress -Depth 10
	$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
	$segment = [System.ArraySegment[byte]]::new($bytes)
	$socket.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $token).Wait()
}

function Receive-Json($socket, $token) {
	$buffer = [byte[]]::new(8192)
	$segment = [System.ArraySegment[byte]]::new($buffer)
	$result = $socket.ReceiveAsync($segment, $token).Result
	$text = [System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
	return $text | ConvertFrom-Json
}

try {
	$ws.ConnectAsync([Uri]$uri, $cts.Token).Wait()

	Send-Json $ws @{ jsonrpc = "2.0"; id = 1; method = "session.create"; params = @{ cwd = $Cwd; mode = "auto" } } $cts.Token
	$sessionResponse = Receive-Json $ws $cts.Token
	$sessionId = $sessionResponse.result.sessionId
	if (-not $sessionId) {
		Write-Error "session.create failed: $($sessionResponse | ConvertTo-Json -Compress)"
		exit 1
	}

	Send-Json $ws @{ jsonrpc = "2.0"; id = 2; method = "message.send"; params = @{ sessionId = $sessionId; text = $Message } } $cts.Token
	$sendResponse = Receive-Json $ws $cts.Token
	Write-Host "queued inbox-check task: session=$sessionId message=$($sendResponse.result.messageId)"
} finally {
	if ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
		$ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $cts.Token).Wait()
	}
	$ws.Dispose()
	$cts.Dispose()
}
