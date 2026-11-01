# Full end-to-end run: UI flow, restart recovery, timer landing, persistence.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/e2e.ps1   (after `npm run build`)
$ErrorActionPreference = 'Stop'
# Some hosts (e.g. VS Code's extension terminal) set this, which makes Electron behave like plain Node.
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$root = Split-Path $PSScriptRoot -Parent
$data = Join-Path $env:TEMP "flight-mode-e2e-$(Get-Random)"
$shots = Join-Path $root 'e2e-screenshots'
$electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
$script = Join-Path $root 'scripts\e2e.cjs'
$file = Join-Path $data 'flight-mode-data.json'

function Run-Phase($phase) {
  # electron.exe is a GUI-subsystem binary, so wait for it explicitly.
  $log = Join-Path $env:TEMP "flight-mode-e2e-$phase.log"
  $p = Start-Process -FilePath $electron -ArgumentList "`"$script`"", $phase, "`"$data`"", "`"$shots`"" `
    -Wait -PassThru -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError "$log.err"
  Get-Content $log, "$log.err" -ErrorAction SilentlyContinue | Where-Object { $_ -match 'e2e|Error|expected' }
  if ($p.ExitCode -ne 0) { throw "Phase '$phase' failed (exit $($p.ExitCode))" }
}

# Rewrites the active flight's start time so that `remainingMs` is left.
function Shift-Flight($remainingMs) {
  $json = Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
  $json.activeFlight.startedAt = $now - $json.activeFlight.plannedDurationMs + $remainingMs
  $json | ConvertTo-Json -Depth 10 | Set-Content $file -Encoding utf8
}

Run-Phase 'ui'
Shift-Flight -120000
Run-Phase 'landed-away'
Shift-Flight 3000
Run-Phase 'resume'
Remove-Item -Recurse -Force $data
Write-Host 'E2E: all phases passed. Screenshots in' $shots
