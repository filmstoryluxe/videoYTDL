# Videografiasi — YouTube, Instagram si TikTok Downloader pentru DaVinci Resolve Studio
# Instalare one-liner: irm https://raw.githubusercontent.com/filmstoryluxe/videoYTDL/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$repo = 'https://github.com/filmstoryluxe/videoYTDL/archive/refs/heads/main.zip'
$tempZip = Join-Path $env:TEMP 'videografiasi-yt.zip'
$tempDir = Join-Path $env:TEMP 'videografiasi-yt'
$target = Join-Path $env:ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\videografiasi-youtube-download'

# ffmpeg essentials (yt-dlp needs ffmpeg + ffprobe for merge/extract)
$ffmpegUrl = 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
$ffmpegZip = Join-Path $env:TEMP 'ffmpeg-videografiasi.zip'

Write-Host 'Videografiasi — YouTube, Instagram si TikTok Downloader pentru DaVinci Resolve' -ForegroundColor Cyan
Write-Host ''

# === 1. Download plugin from GitHub ===
Write-Host '[1/4] Descărcare plugin...' -ForegroundColor Yellow
Invoke-WebRequest -Uri $repo -OutFile $tempZip -UseBasicParsing
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
Remove-Item $tempZip -Force

$source = Join-Path $tempDir 'videoYTDL-main'
if (-not (Test-Path $source)) {
  throw 'Descărcare plugin eșuată. Verifică conexiunea la internet.'
}

# === 2. Download ffmpeg + ffprobe (not in repo, >100MB GitHub limit) ===
Write-Host '[2/4] Descărcare ffmpeg...' -ForegroundColor Yellow
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip -UseBasicParsing
$ffmpegExtract = Join-Path $tempDir 'ffmpeg-extract'
Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force
Remove-Item $ffmpegZip -Force

# Find ffmpeg.exe and ffprobe.exe in extracted folder
$ffmpegExe = Get-ChildItem $ffmpegExtract -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
$ffprobeExe = Get-ChildItem $ffmpegExtract -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
if (-not $ffmpegExe -or -not $ffprobeExe) {
  throw 'Descărcare ffmpeg eșuată. Nu am găsit ffmpeg.exe sau ffprobe.exe.'
}

# Copy ffmpeg binaries into plugin bin/
$binDir = Join-Path $source 'bin'
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Force -Path $binDir | Out-Null }
Copy-Item -Force $ffmpegExe.FullName (Join-Path $binDir 'ffmpeg.exe')
Copy-Item -Force $ffprobeExe.FullName (Join-Path $binDir 'ffprobe.exe')
Remove-Item $ffmpegExtract -Recurse -Force

# === 3. Verify required files ===
Write-Host '[3/4] Verificare...' -ForegroundColor Yellow
$requiredFiles = @('main.js', 'manifest.xml', 'preload.js', 'ui\index.html', 'ui\app.js', 'ui\styles.css', 'bin\yt-dlp.exe', 'bin\ffmpeg.exe', 'bin\ffprobe.exe')
foreach ($file in $requiredFiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $source $file))) {
    throw "Pachet incomplet: lipsește $file"
  }
}

# Find WorkflowIntegration.node from DaVinci Resolve SDK
$developerCandidates = @(
  (Join-Path $env:ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integrations\Examples\SamplePlugin\WorkflowIntegration.node'),
  (Join-Path $env:ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integrations\Examples\SamplePromisePlugin\WorkflowIntegration.node')
)
$developerNode = $developerCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $developerNode) {
  throw 'Nu am găsit WorkflowIntegration.node. Instalează DaVinci Resolve Studio cu Workflow Integrations (Developer Tools) și reîncearcă.'
}

# === 4. Install ===
Write-Host '[4/4] Instalare...' -ForegroundColor Yellow
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $source '*') -Destination $target
Copy-Item -Force $developerNode (Join-Path $target 'WorkflowIntegration.node')

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host ''
Write-Host 'INSTALAT cu succes!' -ForegroundColor Green
Write-Host ''
Write-Host 'Repornește DaVinci Resolve și deschide:' -ForegroundColor White
Write-Host '  Workspace > Workflow Integrations > Videografiasi' -ForegroundColor Cyan