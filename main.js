const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');
const WorkflowIntegration = require('./WorkflowIntegration.node');

const PLUGIN_ID = 'com.videografiasi.youtube.download';
const pluginRoot = __dirname;
let mainWindow;
let resolve;
let isQuitting = false;
let localServer;

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// URL patterns for supported platforms (YouTube + Instagram + TikTok)
const urlPatterns = /^https:\/\/(?:www\.)?(?:youtube\.com|youtu\.be|instagram\.com|tiktok\.com|vm\.tiktok\.com)\//i;

function startLocalServer() {
  return new Promise((resolvePromise, reject) => {
    const root = path.resolve(pluginRoot);
    localServer = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      const relativePath = (url.pathname === '/' ? 'ui/index.html' : url.pathname.replace(/^\/+/, ''));
      const filePath = path.resolve(root, relativePath);
      const rel = path.relative(root, filePath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        response.writeHead(403).end();
        return;
      }
      fs.readFile(filePath, (error, content) => {
        if (error) {
          response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
          return;
        }
        response.writeHead(200, {
          'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.instagram.com https://www.tiktok.com; style-src 'self'; script-src 'self'"
        });
        response.end(content);
      });
    });
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => {
      localServer.removeListener('error', reject);
      resolvePromise(`http://127.0.0.1:${localServer.address().port}`);
    });
  });
}

function executable(name) {
  // Cross-platform: try .exe (Windows) then plain (macOS)
  const withExe = path.join(pluginRoot, 'bin', name + '.exe');
  const plain = path.join(pluginRoot, 'bin', name);
  if (fs.existsSync(withExe)) return withExe;
  if (fs.existsSync(plain)) return plain;
  return name;
}

function ensureTool(name) {
  const execPath = executable(name);
  if (!fs.existsSync(execPath)) {
    throw new Error(`${name} nu a fost găsit. Asigură-te că binarul este prezent în folderul bin/ al plugin-ului.`);
  }
  return execPath;
}

function run(command, args, onProgress) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error('Timeout: descărcarea a durat prea mult.'));
    }, 600000);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      const text = chunk.toString();
      stdout += text;
      if (onProgress) parseProgress(text, onProgress);
    });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      code === 0 ? resolvePromise({ stdout, stderr }) : reject(new Error(stderr || `yt-dlp exited with code ${code}`));
    });
  });
}

function parseProgress(text, emit) {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.startsWith('download;')) continue;
    const parts = line.split(';');
    if (parts.length < 4) continue;
    const percent = parts[1];
    const speed = parts[2];
    const eta = parts[3];
    emit({ percent, speed, eta, raw: line });
  }
}

function videoFormat(height) {
  return `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`;
}

async function importIntoResolve(filePath) {
  if (!resolve) return;
  try {
    const project = resolve.GetProjectManager().GetCurrentProject();
    if (!project) throw new Error('Deschide mai întâi un proiect Resolve.');
    project.GetMediaPool().ImportMedia([filePath]);
  } catch (error) {
    throw new Error(`Fișierul a fost descărcat, dar nu s-a putut importa automat: ${error.message}`);
  }
}

async function setupResolveBridge() {
  try {
    const isSuccess = await WorkflowIntegration.Initialize(PLUGIN_ID);
    if (!isSuccess) {
      console.warn('Videografiasi: Failed to initialize Resolve interface');
      return;
    }
    resolve = await WorkflowIntegration.GetResolve();
    if (!resolve) {
      console.warn('Videografiasi: Failed to get Resolve object');
      return;
    }
    app.on('before-quit', () => {
      try { WorkflowIntegration.CleanUp(); } catch (e) {}
    });
  } catch (error) {
    console.warn('Videografiasi: Resolve bridge unavailable:', error.message);
  }
}

app.whenReady().then(async () => {
  await setupResolveBridge();
  const localOrigin = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 760,
    height: 880,
    minWidth: 720,
    minHeight: 800,
    backgroundColor: '#1a1a1a',
    icon: path.join(pluginRoot, 'ui', 'videografiasi-icon.png'),
    webPreferences: {
      preload: path.join(pluginRoot, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders({
    urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*']
  }, (details, callback) => {
    details.requestHeaders.Referer = `${localOrigin}/`;
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  mainWindow.loadURL(`${localOrigin}/ui/index.html`);
  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });
  globalShortcut.register('CommandOrControl+3', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.on('before-quit', () => { isQuitting = true; });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    localServer?.close();
  });
});

const searchState = { query: '', offset: 0, pageSize: 20 };

ipcMain.handle('search', async (_event, query) => {
  const text = String(query || '').trim();
  if (!text) return [];
  searchState.query = text;
  searchState.offset = 0;
  const tool = ensureTool('yt-dlp');
  const count = searchState.pageSize;
  const { stdout } = await run(tool, [
    '--flat-playlist', '--dump-single-json', '--no-warnings',
    '--playlist-end', String(count), `ytsearch${count}:${text}`
  ]);
  const data = JSON.parse(stdout);
  const entries = (data.entries || []).filter(Boolean).map(item => ({
    id: item.id,
    title: item.title || 'Untitled',
    channel: item.channel || item.uploader || '',
    duration: item.duration_string || '',
    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    url: item.webpage_url || `https://www.youtube.com/watch?v=${item.id}`
  }));
  searchState.offset = entries.length;
  return entries;
});

ipcMain.handle('search-more', async () => {
  if (!searchState.query) return [];
  const tool = ensureTool('yt-dlp');
  const start = searchState.offset + 1;
  const end = searchState.offset + searchState.pageSize;
  // Request enough total results to cover the next page
  const totalNeeded = end;
  const { stdout } = await run(tool, [
    '--flat-playlist', '--dump-single-json', '--no-warnings',
    '--playlist-start', String(start),
    '--playlist-end', String(end),
    `ytsearch${totalNeeded}:${searchState.query}`
  ]);
  const data = JSON.parse(stdout);
  const entries = (data.entries || []).filter(Boolean).map(item => ({
    id: item.id,
    title: item.title || 'Untitled',
    channel: item.channel || item.uploader || '',
    duration: item.duration_string || '',
    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    url: item.webpage_url || `https://www.youtube.com/watch?v=${item.id}`
  }));
  if (entries.length > 0) {
    searchState.offset += entries.length;
  }
  return entries;
});

ipcMain.handle('get-info', async (_event, url) => {
  const sourceUrl = String(url || '').trim();
  if (!urlPatterns.test(sourceUrl)) {
    throw new Error('URL invalid. Suportă YouTube, Instagram și TikTok.');
  }
  const tool = ensureTool('yt-dlp');
  const { stdout } = await run(tool, ['--dump-json', '--no-warnings', sourceUrl]);
  const info = JSON.parse(stdout);
  return {
    id: info.id,
    title: info.title || 'Untitled',
    duration: info.duration || 0,
    duration_string: info.duration_string || '',
    uploader: info.uploader || info.channel || '',
    thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.id}/hqdefault.jpg`,
    webpage_url: info.webpage_url || sourceUrl,
    formats: (info.formats || []).map(f => ({
      format_id: f.format_id,
      ext: f.ext,
      resolution: f.resolution,
      height: f.height,
      width: f.width,
      fps: f.fps,
      vcodec: f.vcodec,
      acodec: f.acodec,
      filesize: f.filesize,
      filesize_approx: f.filesize_approx,
      abr: f.abr,
      vbr: f.vbr
    }))
  };
});

ipcMain.handle('download', async (_event, request) => {
  const sourceUrl = String(request.url || '');
  const format = String(request.format || 'mp4-1080');
  if (!urlPatterns.test(sourceUrl)) {
    throw new Error('URL invalid. Suportă YouTube, Instagram și TikTok.');
  }

  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Alege folderul pentru download',
    properties: ['openDirectory', 'createDirectory']
  });
  if (picked.canceled || !picked.filePaths[0]) return { canceled: true };

  const folder = picked.filePaths[0];
  const output = path.join(folder, '%(title).180B [%(id)s].%(ext)s');
  const args = ['--no-playlist', '--no-warnings', '--restrict-filenames', '--paths', folder, '-o', output, '--print', 'after_move:filepath'];

  if (format === 'mp3' || format === 'wav') {
    args.push('-x', '--audio-format', format, '--audio-quality', '0');
  } else if (format === 'mp4') {
    args.push('-f', 'best[ext=mp4]/best');
  } else {
    const height = { 'mp4-2160': 2160, 'mp4-1080': 1080, 'mp4-720': 720 }[format] || 1080;
    args.push('-f', videoFormat(height), '--merge-output-format', 'mp4');
  }
  args.push('--newline', '--progress-template', 'download;%(progress._percent_str)s;%(progress._speed_str)s;%(progress._eta_str)s', sourceUrl);

  const sendProgress = data => {
    if (mainWindow?.webContents && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('progress', { ...data, url: sourceUrl });
    }
  };

  const tool = ensureTool('yt-dlp');
  const { stdout } = await run(tool, args, sendProgress);
  const filePath = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
  if (!filePath || !fs.existsSync(filePath)) throw new Error('Download-ul s-a terminat, dar fișierul final nu a fost găsit.');
  await importIntoResolve(filePath);
  return { canceled: false, filePath };
});
