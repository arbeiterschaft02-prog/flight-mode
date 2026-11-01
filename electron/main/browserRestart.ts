import { execFile } from 'node:child_process';

/**
 * Restarting the user's browser so it picks up the hosts block.
 *
 * A Chromium browser that has been open for days can stop noticing hosts-file
 * changes and keep resolving names itself; a fresh process always honours the
 * file. Killing the browser loses the session, and closing its windows one by
 * one only keeps the last window. The Windows Restart Manager instead asks the
 * browser to end as it would at sign-out, which saves every window, and the
 * browser is then relaunched with --restore-last-session.
 *
 * Only ever runs when the user presses the button and confirms.
 */

const BROWSERS: Record<string, string> = {
  'chrome.exe': 'Chrome',
  'msedge.exe': 'Edge',
  'browser.exe': 'Яндекс Браузер',
  'brave.exe': 'Brave',
  'opera.exe': 'Opera',
  'vivaldi.exe': 'Vivaldi'
};

function exec(file: string, args: string[], timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) reject(new Error(String(stderr || error.message).trim()));
      else resolve(String(stdout));
    });
  });
}

/**
 * Browser (main) processes that have an open window. Helper processes carry a
 * --type= switch; a browser idling in the background without windows (Edge
 * does this) is left alone, since relaunching it would open a window.
 */
export const FIND_BROWSERS_PS = String.raw`
$names = @(${Object.keys(BROWSERS)
  .map((n) => `'${n}'`)
  .join(',')})
$mains = @(Get-CimInstance Win32_Process | Where-Object {
  $names -contains $_.Name.ToLower() -and $_.CommandLine -and $_.CommandLine -notmatch '--type=' -and
  ($_.Name -ne 'browser.exe' -or $_.ExecutablePath -like '*Yandex*') -and
  (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).MainWindowHandle -ne 0
})
`;

async function runPs(script: string, timeout: number): Promise<string[]> {
  const encoded = Buffer.from(`$ErrorActionPreference = 'Stop'\n$ProgressPreference = 'SilentlyContinue'\n${script}`, 'utf16le').toString('base64');
  const out = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], timeout);
  const json = out.trim().split(/\r?\n/).pop() || '[]';
  const exes = JSON.parse(json) as string[] | string;
  return [...new Set((Array.isArray(exes) ? exes : [exes]).map((exe) => BROWSERS[exe] ?? exe))];
}

/** Display names of supported browsers that have an open window right now. */
export async function getRunningBrowsers(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  return runPs(`${FIND_BROWSERS_PS}\nif ($mains.Count -eq 0) { '[]' } else { ConvertTo-Json -Compress @($mains | ForEach-Object { $_.Name.ToLower() } | Select-Object -Unique) }`, 20_000);
}

export const RESTART_PS = String.raw`
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices; using FILETIME = System.Runtime.InteropServices.ComTypes.FILETIME;
public static class FmRm {
  [StructLayout(LayoutKind.Sequential)] struct RM_UNIQUE_PROCESS { public int dwProcessId; public FILETIME ProcessStartTime; }
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)] static extern int RmStartSession(out uint h, int f, System.Text.StringBuilder key);
  [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)] static extern int RmRegisterResources(uint h, uint nFiles, string[] files, uint nApps, RM_UNIQUE_PROCESS[] apps, uint nSvc, string[] svcs);
  [DllImport("rstrtmgr.dll")] static extern int RmShutdown(uint h, uint flags, IntPtr cb);
  [DllImport("rstrtmgr.dll")] static extern int RmEndSession(uint h);
  public static int Shutdown(int[] pids, long[] starts) {
    uint h; int r = RmStartSession(out h, 0, new System.Text.StringBuilder(64));
    if (r != 0) return r;
    try {
      var apps = new RM_UNIQUE_PROCESS[pids.Length];
      for (int i = 0; i < pids.Length; i++) {
        apps[i].dwProcessId = pids[i];
        apps[i].ProcessStartTime.dwLowDateTime = (int)(starts[i] & 0xFFFFFFFF);
        apps[i].ProcessStartTime.dwHighDateTime = (int)(starts[i] >> 32);
      }
      r = RmRegisterResources(h, 0, null, (uint)apps.Length, apps, 0, null);
      return r != 0 ? r : RmShutdown(h, 0, IntPtr.Zero);
    } finally { RmEndSession(h); }
  }
}
'@
__FIND__
if ($mains.Count -eq 0) { '[]'; exit 0 }
$launch = @{}
foreach ($m in $mains) {
  $keep = @([regex]::Matches($m.CommandLine, '--(user-data-dir|profile-directory)=("[^"]*"|\S+)') | ForEach-Object { $_.Value })
  $launch[$m.ExecutablePath + '|' + ($keep -join ' ')] = @{ Exe = $m.ExecutablePath; Args = $keep; Name = $m.Name.ToLower() }
}
$pids = [int[]]@($mains | ForEach-Object { [int]$_.ProcessId })
$starts = [long[]]@($mains | ForEach-Object { (Get-Process -Id $_.ProcessId).StartTime.ToFileTime() })
$r = [FmRm]::Shutdown($pids, $starts)
if ($r -ne 0) { throw "Restart Manager error $r" }
for ($i = 0; $i -lt 40 -and @(Get-Process -Id $pids -ErrorAction SilentlyContinue).Count -gt 0; $i++) { Start-Sleep -Milliseconds 250 }
foreach ($l in $launch.Values) { Start-Process -FilePath $l.Exe -ArgumentList (@($l.Args) + '--restore-last-session') }
ConvertTo-Json -Compress @($launch.Values | ForEach-Object { $_.Name } | Select-Object -Unique)
`;

/** Gracefully closes running browsers and reopens them with their tabs. */
export async function restartBrowsers(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  return runPs(RESTART_PS.replace('__FIND__', () => FIND_BROWSERS_PS), 60_000);
}
