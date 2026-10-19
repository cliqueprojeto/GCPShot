param([string]$Executable, [Parameter(Mandatory=$true)][string]$ExpectedIcon, [Parameter(Mandatory=$true)][string]$WindowHandle)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class GCPShotIconProbe {
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
$expected = [System.Drawing.Icon]::new($ExpectedIcon, 32, 32)
$expectedBitmap = $expected.ToBitmap()
function Assert-AppIcon([System.Drawing.Icon]$Icon, [string]$Label) {
  $original = $Icon.ToBitmap()
  $bitmap = [System.Drawing.Bitmap]::new($original, 32, 32)
  try {
    [double]$difference = 0
    [int]$samples = 0
    for ($y = 0; $y -lt 32; $y++) {
      for ($x = 0; $x -lt 32; $x++) {
        $wanted = $expectedBitmap.GetPixel($x, $y)
        if ($wanted.A -lt 200) { continue }
        $actual = $bitmap.GetPixel($x, $y)
        $difference += [Math]::Abs([int]$actual.R - $wanted.R) + [Math]::Abs([int]$actual.G - $wanted.G) + [Math]::Abs([int]$actual.B - $wanted.B)
        $samples += 3
      }
    }
    $mean = $difference / $samples
    if ($mean -gt 24) { throw "$Label does not match the GCPShot icon (mean difference $mean)." }
    Write-Output "$Label uses the GCPShot icon (mean difference $mean)."
  } finally { $bitmap.Dispose(); $original.Dispose() }
}
try {
  if ($Executable) {
    $executableIcon = [System.Drawing.Icon]::ExtractAssociatedIcon($Executable)
    try { Assert-AppIcon $executableIcon 'Executable' } finally { $executableIcon.Dispose() }
  }
  $handle = [IntPtr]::new([long]$WindowHandle)
  $iconHandle = [GCPShotIconProbe]::SendMessage($handle, 0x7F, [IntPtr]::new(1), [IntPtr]::Zero)
  if ($iconHandle -eq [IntPtr]::Zero) { $iconHandle = [GCPShotIconProbe]::SendMessage($handle, 0x7F, [IntPtr]::Zero, [IntPtr]::Zero) }
  if ($iconHandle -eq [IntPtr]::Zero) { throw 'The application window has no explicit icon.' }
  $windowIcon = [System.Drawing.Icon]::FromHandle($iconHandle)
  try { Assert-AppIcon $windowIcon 'Window/taskbar' } finally { $windowIcon.Dispose() }
} finally { $expectedBitmap.Dispose(); $expected.Dispose() }
