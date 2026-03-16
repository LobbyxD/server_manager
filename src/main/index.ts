/**
 * Electron main process entry point.
 * Responsibilities:
 *  - Enforce single-instance lock.
 *  - Register IPC handlers for window controls.
 *  - Create the BrowserWindow and system tray.
 *  - Auto-start servers flagged for it.
 *  - Force-kill all servers before quit.
 */

import { app, dialog, ipcMain, BrowserWindow } from 'electron';
import { createWindow, mainWindow } from './window';
import { createTray, destroyTray } from './tray';
import {
  registerIpcHandlers,
  startAutoStartServers,
  stopAllServers,
  stopAllServersSafe,
  getRunningServerNames,
} from './ipcHandlers';
import { getSettings } from './store';
import { IPC } from '../shared/types';
import { initSteam, shutdownSteam, unlockAchievement, ACH } from './steam';

// ---------------------------------------------------------------------------
// Single-instance guard
// ---------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  // Another instance is already running – hand focus to it and exit.
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    // Flash the taskbar button so the user notices the window coming to front.
    mainWindow.flashFrame(true);
  }
});

// ---------------------------------------------------------------------------
// Window control IPC (handled in main so they fire even before the window
// is fully ready, and to keep window state logic server-side)
// ---------------------------------------------------------------------------

ipcMain.on(IPC.WINDOW_MINIMIZE, () => mainWindow?.minimize());

ipcMain.on(IPC.WINDOW_MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.on(IPC.WINDOW_CLOSE, () => {
  const { minimizeToTray } = getSettings();
  if (minimizeToTray) {
    // Just hide – never show the quit dialog for a tray-hide action.
    mainWindow?.hide();
  } else {
    // Trigger the window's 'close' event so the quit dialog can intercept it.
    mainWindow?.close();
  }
});

ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => mainWindow?.isMaximized() ?? false);

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  registerIpcHandlers();

  // Steamworks ownership check (production only – no-op in dev builds).
  if (!initSteam()) {
    dialog.showErrorBox(
      'Steam Required',
      'Minecraft Server Manager requires Steam to be running and you must own this app.\n\nPlease open Steam and log in, then launch the app again.',
    );
    app.quit();
    return;
  }

  createWindow();
  createTray();
  startAutoStartServers();

  // ---------------------------------------------------------------------------
  // Quit dialog – intercept window close if servers are still running.
  // ---------------------------------------------------------------------------

  /**
   * When true, the quit has already been confirmed by the user (or there were
   * no running servers). The 'close' event handler will not intercept it.
   */
  let quitConfirmed = false;

  mainWindow!.on('close', (e) => {
    if (quitConfirmed) return; // already confirmed – let Electron proceed

    const running = getRunningServerNames();
    if (running.length === 0) return; // nothing running, close normally

    // Prevent the default close and ask the renderer what to do.
    e.preventDefault();
    mainWindow!.webContents.send(IPC.QUIT_REQUEST, running);
  });

  /** Graceful exit: send 'stop' to all servers, wait, then quit. */
  ipcMain.handle(IPC.QUIT_SAFE, async () => {
    unlockAchievement(ACH.SAFE_EXIT);
    await stopAllServersSafe();
    quitConfirmed = true;
    app.quit();
  });

  /** Immediate exit: force-kill all servers then quit. */
  ipcMain.handle(IPC.QUIT_FORCE, () => {
    quitConfirmed = true;
    stopAllServers();
    app.quit();
  });

  /** Cancel: do nothing – window stays open. */
  ipcMain.handle(IPC.QUIT_CANCEL, () => { /* no-op */ });

  // macOS: re-create the window when the dock icon is clicked and no windows exist.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// On Windows/Linux: only keep alive if minimizeToTray is enabled.
// If tray is disabled, quit normally when the window is closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const { minimizeToTray } = getSettings();
    if (!minimizeToTray) {
      app.quit();
    }
    // else: tray icon keeps the process alive
  }
});

app.on('before-quit', () => {
  destroyTray();
  shutdownSteam();
  // Last-resort cleanup – force-kill anything still alive.
  stopAllServers();
});
