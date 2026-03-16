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
  // Delegate entirely to the 'close' event handler below, which decides
  // whether to hide (minimize-to-tray) or show the quit dialog.
  mainWindow?.close();
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

  /**
   * Called when the user explicitly chooses Quit from the tray context menu.
   * Bypasses minimize-to-tray logic: always quits (or shows the quit dialog
   * if servers are still running).
   */
  const onTrayQuit = () => {
    const running = getRunningServerNames();
    if (running.length > 0) {
      // Servers running – show the window so the quit dialog is visible.
      mainWindow?.show();
      mainWindow?.focus();
      mainWindow?.webContents.send(IPC.QUIT_REQUEST, running);
    } else {
      quitConfirmed = true;
      app.quit();
    }
  };

  createTray(onTrayQuit);
  startAutoStartServers();

  // ---------------------------------------------------------------------------
  // Quit dialog – intercept window close if servers are still running.
  // ---------------------------------------------------------------------------

  /**
   * When true, the close event should proceed to actually destroy the window
   * (the user confirmed quit, or there were no running servers and tray is off).
   */
  let quitConfirmed = false;

  mainWindow!.on('close', (e) => {
    if (quitConfirmed) return; // confirmed – let Electron destroy the window

    // Always intercept the close so the window is never silently destroyed.
    e.preventDefault();

    const running = getRunningServerNames();

    if (running.length > 0) {
      // Servers are running – show the window and ask the user what to do.
      mainWindow!.show();
      mainWindow!.focus();
      mainWindow!.webContents.send(IPC.QUIT_REQUEST, running);
      return;
    }

    // No servers running. Respect minimize-to-tray vs actual quit.
    const { minimizeToTray } = getSettings();
    if (minimizeToTray) {
      mainWindow!.hide();
    } else {
      quitConfirmed = true;
      app.quit();
    }
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

  /** Cancel: do nothing – window stays hidden/open. */
  ipcMain.handle(IPC.QUIT_CANCEL, () => { /* no-op */ });

  // macOS: re-create the window when the dock icon is clicked and no windows exist.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// The close event handler above always prevents window destruction unless
// quitConfirmed is true, so this only fires during an intentional quit.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  destroyTray();
  shutdownSteam();
  // Last-resort cleanup – force-kill anything still alive.
  stopAllServers();
});
