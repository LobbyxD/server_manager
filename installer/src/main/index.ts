import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import { join } from 'path';
import { spawn } from 'child_process';
import path from 'path';
import { registerHandlers, silentUpdate } from './ipcHandlers';

// ---------------------------------------------------------------------------
// Silent update mode — triggered by the main app's auto-updater.
// Installs files silently (no window), launches the updated app, then quits.
// ---------------------------------------------------------------------------

const isSilentUpdate = process.argv.includes('--update');

if (isSilentUpdate) {
  app.whenReady().then(() => {
    try {
      const installPath = silentUpdate();
      const exePath = path.join(installPath, 'Minecraft Server Manager.exe');
      spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
    } catch {
      // If something went wrong, quit cleanly — user can relaunch manually.
    } finally {
      app.quit();
    }
  });
} else {
  // ---------------------------------------------------------------------------
  // Normal installer UI mode
  // ---------------------------------------------------------------------------

  if (!app.requestSingleInstanceLock()) {
    app.quit();
    process.exit(0);
  }

  let win: BrowserWindow | null = null;

  function createWindow(): void {
    const iconPath = join(__dirname, '../../resources/icon.png');
    let icon: Electron.NativeImage | undefined;
    try {
      const img = nativeImage.createFromPath(iconPath);
      if (!img.isEmpty()) icon = img;
    } catch { /* ignore */ }

    win = new BrowserWindow({
      width: 580,
      height: 520,
      resizable: false,
      center: true,
      icon,
      title: 'Minecraft Server Manager Setup',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
      },
      show: false,
    });

    win.setMenu(null);

    win.on('ready-to-show', () => win?.show());

    if (process.env.NODE_ENV === 'development' && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(process.env['ELECTRON_RENDERER_URL']);
      win.webContents.openDevTools({ mode: 'detach' });
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'));
    }
  }

  app.whenReady().then(() => {
    registerHandlers(() => win);
    createWindow();
  });

  app.on('window-all-closed', () => app.quit());

  // Allow renderer to close the window programmatically.
  ipcMain.on('installer:close', () => win?.close());
}
