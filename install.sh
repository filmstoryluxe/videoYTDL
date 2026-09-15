#!/bin/bash
# Videografiasi - macOS installer
# One-liner: curl -sL https://raw.githubusercontent.com/filmstoryluxe/videoYTDL/main/install.sh | bash

set -e

REPO="https://github.com/filmstoryluxe/videoYTDL/archive/refs/heads/main.zip"
TEMP_DIR=$(mktemp -d)
TARGET="/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Workflow Integration Plugins/videografiasi-youtube-download"

echo "Videografiasi - YouTube, Instagram si TikTok Downloader pentru DaVinci Resolve"
echo ""

# === 1. Download plugin ===
echo "[1/5] Descarcare plugin..."
curl -sL "$REPO" -o "$TEMP_DIR/plugin.zip"
unzip -q "$TEMP_DIR/plugin.zip" -d "$TEMP_DIR"
rm "$TEMP_DIR/plugin.zip"
SOURCE="$TEMP_DIR/videoYTDL-main"

if [ ! -d "$SOURCE" ]; then
  echo "Eroare: Descarcare esuata."
  exit 1
fi

# === 2. yt-dlp ===
echo "[2/5] Descarcare yt-dlp..."
mkdir -p "$SOURCE/bin"
curl -sL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos_universal" -o "$SOURCE/bin/yt-dlp"
chmod +x "$SOURCE/bin/yt-dlp"

# === 3. ffmpeg ===
echo "[3/5] Descarcare ffmpeg..."
ARCH=$(uname -m)

if command -v ffmpeg >/dev/null 2>&1; then
  echo "    ffmpeg in PATH - folosesc system"
  ln -sf "$(which ffmpeg)" "$SOURCE/bin/ffmpeg"
  ln -sf "$(which ffprobe)" "$SOURCE/bin/ffprobe"
elif [ "$ARCH" = "arm64" ]; then
  echo "    Apple Silicon - ffmpeg ARM..."
  FFMPEG_URL="https://www.osxexperts.net/arm-ffmpeg-7.0.zip"
  if curl -sL "$FFMPEG_URL" -o "$TEMP_DIR/ffmpeg-mac.zip" 2>/dev/null; then
    unzip -q -o "$TEMP_DIR/ffmpeg-mac.zip" -d "$TEMP_DIR/ffmpeg-extract" 2>/dev/null
    FB=$(find "$TEMP_DIR/ffmpeg-extract" -name ffmpeg -type f | head -1)
    FP=$(find "$TEMP_DIR/ffmpeg-extract" -name ffprobe -type f | head -1)
    if [ -n "$FB" ]; then cp "$FB" "$SOURCE/bin/ffmpeg"; chmod +x "$SOURCE/bin/ffmpeg"; fi
    if [ -n "$FP" ]; then cp "$FP" "$SOURCE/bin/ffprobe"; chmod +x "$SOURCE/bin/ffprobe"; fi
  fi
  if [ ! -f "$SOURCE/bin/ffmpeg" ]; then
    echo "    ATENTIE: brew install ffmpeg"
  fi
else
  echo "    Intel Mac - ffmpeg..."
  curl -sL "https://evermeet.cx/ffmpeg/get/ffmpeg/zip" -o "$TEMP_DIR/ffmpeg.zip"
  curl -sL "https://evermeet.cx/ffmpeg/get/ffprobe/zip" -o "$TEMP_DIR/ffprobe.zip"
  unzip -q -o "$TEMP_DIR/ffmpeg.zip" -d "$SOURCE/bin/"
  unzip -q -o "$TEMP_DIR/ffprobe.zip" -d "$SOURCE/bin/"
  chmod +x "$SOURCE/bin/ffmpeg" "$SOURCE/bin/ffprobe" 2>/dev/null || true
fi

# === 4. Verify ===
echo "[4/5] Verificare..."
REQUIRED=("main.js" "manifest.xml" "preload.js" "ui/index.html" "ui/app.js" "ui/styles.css")
for f in "${REQUIRED[@]}"; do
  if [ ! -f "$SOURCE/$f" ]; then
    echo "Eroare: lipseste $f"
    exit 1
  fi
done

# === 5. WorkflowIntegration.node ===
echo "    Caut WorkflowIntegration.node..."
DEV_NODE=""

# Cautare in toate locatiile posibile
for candidate in \
  "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node" \
  "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations/Examples/SamplePromisePlugin/WorkflowIntegration.node" \
  "$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node" \
  "$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations/Examples/SamplePromisePlugin/WorkflowIntegration.node" \
  "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Support/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node" \
  "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Support/Developer/Workflow Integrations/Examples/SamplePromisePlugin/WorkflowIntegration.node" \
  "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Resources/Support/Developer/Workflow Integrations/Examples/SamplePlugin/WorkflowIntegration.node" \
  "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Resources/Support/Developer/Workflow Integrations/Examples/SamplePromisePlugin/WorkflowIntegration.node"; do
  if [ -f "$candidate" ]; then
    DEV_NODE="$candidate"
    echo "    Gasit: $candidate"
    break
  fi
done

# Fallback: cautare cu find in directoarele Blackmagic Design si Applications
if [ -z "$DEV_NODE" ]; then
  echo "    Cautare automata..."
  for search_dir in \
    "/Library/Application Support/Blackmagic Design" \
    "$HOME/Library/Application Support/Blackmagic Design" \
    "/Applications/DaVinci Resolve"; do
    if [ -d "$search_dir" ]; then
      FOUND=$(find "$search_dir" -name "WorkflowIntegration.node" -type f 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        DEV_NODE="$FOUND"
        echo "    Gasit: $FOUND"
        break
      fi
    fi
  done
fi

if [ -z "$DEV_NODE" ]; then
  echo ""
  echo "Eroare: Nu am gasit WorkflowIntegration.node"
  echo ""
  echo "Acest fisier vine cu DaVinci Resolve. Posibile cauze:"
  echo "  1. DaVinci Resolve nu este instalat"
  echo "  2. Nu ai instalat Workflow Integration plugin din DaVinci Resolve"
  echo "  3. Versiune diferita de DaVinci Resolve"
  echo ""
  echo "Incearca manual:"
  echo "  find / -name WorkflowIntegration.node 2>/dev/null"
  echo ""
  echo "Daca l-ai gasit, copiaza-l in plugin si ruleaza din nou."
  exit 1
fi

# === Install ===
echo "[5/5] Instalare..."
sudo rm -rf "$TARGET" 2>/dev/null || true
sudo mkdir -p "$TARGET"
sudo cp -R "$SOURCE/"* "$TARGET/"
sudo cp "$DEV_NODE" "$TARGET/WorkflowIntegration.node"

rm -rf "$TEMP_DIR"

echo ""
echo "INSTALAT cu succes!"
echo ""
echo "Reporneste DaVinci Resolve si deschide:"
echo "  Workspace > Workflow Integrations > Videografiasi"
