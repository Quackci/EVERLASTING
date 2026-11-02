/**
 * Electron main process: window, integer-scaled rendering surface, save IPC.
 * contextIsolation is on and nodeIntegration is off; the renderer only sees the
 * narrow bridge defined in src/preload/preload.ts.
 */
import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

// Only talk to a dev server when one was explicitly supplied; otherwise load the
// built renderer so `npm run dev:electron` works offline with no extra process.
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

// An AppImage cannot carry a setuid sandbox helper, and several distributions
// (Ubuntu 23.10+) refuse unprivileged user namespaces, so Chromium's sandbox
// cannot start from a direct `./Everlasting-*.AppImage` run. The generated
// .desktop entry already passes --no-sandbox; doing it here covers launching the
// file directly. The game is offline, single-player and loads no remote content.
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

function savesDirectory(): string {
  return path.join(app.getPath('userData'), 'saves');
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function slotPath(slot: number): string {
  const safe = Math.max(1, Math.min(9, Math.trunc(slot)));
  return path.join(savesDirectory(), `slot-${safe}.json`);
}

async function readTextSafely(filePath: string): Promise<{ ok: boolean; data: string | null; error: string | null }> {
  try {
    const data = await fsp.readFile(filePath, 'utf8');
    return { ok: true, data, error: null };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { ok: true, data: null, error: null };
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeTextAtomic(filePath: string, data: string): Promise<{ ok: boolean; data: string | null; error: string | null }> {
  try {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.tmp`;
    await fsp.writeFile(temporary, data, 'utf8');
    if (fs.existsSync(filePath)) {
      await fsp.copyFile(filePath, `${filePath}.bak`);
    }
    await fsp.rename(temporary, filePath);
    return { ok: true, data: null, error: null };
  } catch (error) {
    return { ok: false, data: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 270,
    backgroundColor: '#0b0f12',
    show: false,
    autoHideMenuBar: true,
    title: 'Everlasting: Infinite Hallways',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_SERVER_URL) {
    void window.loadURL(DEV_SERVER_URL);
  } else {
    void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  window.on('blur', () => {
    window.webContents.send('window:blurred');
  });
  window.on('focus', () => {
    window.webContents.send('window:focused');
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Game',
        submenu: [
          { role: 'togglefullscreen' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'View',
        submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
      },
    ]),
  );

  ipcMain.handle('save:read', async (_event, slot: number) => readTextSafely(slotPath(slot)));

  ipcMain.handle('save:write', async (_event, slot: number, data: string) => {
    if (typeof data !== 'string' || data.length > 2_000_000) {
      return { ok: false, data: null, error: 'Invalid save payload' };
    }
    return writeTextAtomic(slotPath(slot), data);
  });

  ipcMain.handle('save:list', async () => {
    const results: { slot: number; ok: boolean; data: string | null; error: string | null }[] = [];
    for (let slot = 1; slot <= 3; slot += 1) {
      results.push({ slot, ...(await readTextSafely(slotPath(slot))) });
    }
    return results;
  });

  ipcMain.handle('settings:read', async () => readTextSafely(settingsPath()));
  ipcMain.handle('settings:write', async (_event, data: string) => writeTextAtomic(settingsPath(), data));

  ipcMain.handle('app:platform', () => process.platform);

  ipcMain.on('app:quit', () => {
    app.quit();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
