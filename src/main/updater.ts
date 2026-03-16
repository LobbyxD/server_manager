/**
 * Auto-update integration using electron-updater.
 * Checks GitHub Releases for newer versions and drives a progress flow
 * that is pushed to the renderer via IPC.
 *
 * Flow:
 *  1. On launch: checkForUpdatesOnLaunch() runs after a short delay (non-blocking).
 *  2. User can also trigger a manual check via the Settings UI.
 *  3. When an update is available the renderer shows a Download button.
 *  4. After download completes the renderer shows a "Restart & Install" button.
 */

import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow, app } from 'electron';
import { IPC, UpdaterStatus } from '../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcast(status: UpdaterStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATER_STATUS, status);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setupUpdater(): void {
  // Never auto-download — let the user decide.
  autoUpdater.autoDownload = false;
  // Don't silently install on quit; we handle that via the UI.
  autoUpdater.autoInstallOnAppQuit = false;
  // Allow pre-release channels if needed (leave false for stable releases).
  autoUpdater.allowPrerelease = false;

  // ---- Event → broadcast mapping ----------------------------------------

  autoUpdater.on('checking-for-update', () =>
    broadcast({ state: 'checking' }));

  autoUpdater.on('update-available', (info) =>
    broadcast({ state: 'available', version: info.version }));

  autoUpdater.on('update-not-available', () =>
    broadcast({ state: 'not-available' }));

  autoUpdater.on('download-progress', (progress) =>
    broadcast({
      state: 'downloading',
      version: progress.version,
      percent: Math.floor(progress.percent),
    }));

  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ state: 'ready', version: info.version }));

  autoUpdater.on('error', (err) =>
    broadcast({ state: 'error', error: err.message }));

  // ---- IPC handlers --------------------------------------------------------

  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    if (!app.isPackaged) {
      // In dev mode there is no app-update.yml — skip silently.
      broadcast({ state: 'not-available' });
      return;
    }
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => {
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle(IPC.UPDATER_INSTALL, () => {
    // isSilent=false so UAC prompt appears; isForceRunAfter=true restarts the app.
    autoUpdater.quitAndInstall(false, true);
  });
}

/**
 * Non-blocking background check run 3 s after the window is ready.
 * Errors are silently swallowed so a failed network call never surfaces to
 * the user on every launch.
 */
export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged) return; // skip in dev
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => { /* silently ignore */ });
  }, 3000);
}
