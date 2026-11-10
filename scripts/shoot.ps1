param(
  [string]$Out = "shots",
  [string]$Sizes = "1440x900,1024x640",
  [string]$Pages = "conversation.html,index.html,hero.html,hero-en.html,index.html?act=load,index.html?act=enter,index.html?act=enter&hold=120,index.html?act=nav,index.html?act=burst,hero.html?act=stamp&hold=150"
)
# Local visual check of the labeled fixtures (file://, no server). Run `npm run build` first.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot
New-Item -ItemType Directory -Force $Out | Out-Null
$outDir = (Resolve-Path $Out).Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" }
$prof = Join-Path $outDir ".chrome-profile"
foreach ($page in $Pages.Split(",")) {
  $file, $query = $page.Split("?", 2)
  $url = "file:///" + ((Join-Path $root "preview\$file") -replace '\\', '/' -replace ' ', '%20')
  if ($query) { $url += "?$query" }
  $name = ($page -replace '\.html', '' -replace '[^A-Za-z0-9-]+', '-').Trim('-')
  foreach ($size in $Sizes.Split(",")) {
    $w, $h = $size.Split("x")
    $shot = Join-Path $outDir "$name-$size.png"
    & $chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files --user-data-dir="$prof" --window-size="$w,$h" --hide-scrollbars --virtual-time-budget=4000 --screenshot="$shot" $url 2>&1 | Out-Null
    Write-Output $shot
  }
}
