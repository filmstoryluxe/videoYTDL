# Videografiasi — YouTube Downloader pentru DaVinci Resolve Studio
# Instalare one-liner: irm https://raw.githubusercontent.com/filmstoryluxe/videoYTDL/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$repo = 'https://github.com/filmstoryluxe/videoYTDL/archive/refs/heads/main.zip'
$tempZip = Join-Path $env:TEMP 'videografiasi-yt.zip'
$tempDir = Join-Path $env:TEMP 'videografiasi-yt'
$target = Join-Path $env:ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\videografiasi-youtube-download'

Write-Host 'Videografiasi — YouTube Downloader pentru DaVinci Resolve' -ForegroundColor Cyan
Write-Host 'Descărcare...' -ForegroundColor Yellow

# Download repo zip
Invoke-WebRequest -Uri $repo -OutFile $tempZip -UseBasicParsing

# Clean previous extract
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
Remove-Item $tempZip -Force

# Find extracted folder (videoYTDL-main)
$source = Join-Path $tempDir 'videoYTDL-main'
if (-not (Test-Path $source)) {
  throw 'Descărcare eșuată. Verifică conexiunea la internet.'
}

# Verify required files
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

# Install
Write-Host 'Instalare...' -ForegroundColor Yellow
if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item -Recurse -Force -Path (Join-Path $source '*') -Destination $target
Copy-Item -Force $developerNode (Join-Path $target 'WorkflowIntegration.node')

# Cleanup
Remove-Item $tempDir -Recurse -Force

Write-Host ''
Write-Host 'INSTALAT cu succes!' -ForegroundColor Green
Write-Host 'Repornește DaVinci Resolve și deschide:' -ForegroundColor White
Write-Host '  Workspace > Workflow Integrations > Videografiasi' -ForegroundColor Cyan