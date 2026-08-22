# Videografiasi — YouTube Downloader pentru DaVinci Resolve Studio

Plugin Workflow Integration pentru DaVinci Resolve Studio. Caută și descarcă video/audio de pe YouTube direct din DaVinci Resolve.

## Instalare rapidă

Deschide **PowerShell ca Administrator** și rulează:

```powershell
irm https://raw.githubusercontent.com/filmstoryluxe/videoYTDL/main/install.ps1 | iex
```

Asta e tot. Repornește DaVinci Resolve → Workspace → Workflow Integrations → Videografiasi.

## Instalare manuală

1. Descarcă folderul `videografiasi-youtube-download`
2. Deschide PowerShell ca admin și rulează:
```powershell
powershell -ExecutionPolicy Bypass -File "C:\cale\către\videografiasi-youtube-download\install.ps1"
```

## Funcționalități

- Căutare YouTube direct din DaVinci Resolve
- Descărcare audio: WAV, MP3
- Descărcare video: 4K, 1080p, 720p (MP4)
- Preview inline YouTube (click thumbnail)
- Paginare rezultate (20/pagină)
- Auto-import în Media Pool
- Motor: yt-dlp 2026.08.19 + ffmpeg

## Cerințe

- DaVinci Resolve Studio (cu Workflow Integrations instalat)
- Windows 10/11
- Conexiune internet

## Versiune

- Plugin: 0.1.0
- yt-dlp: 2026.08.19
- ffmpeg: N-126239