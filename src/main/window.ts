/**
 * Creates and manages the main BrowserWindow.
 * The window is frameless (no native Windows chrome) so the renderer
 * can render a fully custom title bar.
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';

export let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 940,
    minHeight: 620,
    // Frameless so we can render a custom title bar in the renderer.
    frame: false,
    // Use a solid dark background to avoid white flash on load.
    backgroundColor: '#0f0f0f',
    webPreferences: {
      // Absolute path to the compiled preload script.
      preload: join(__dirname, '../preload/index.js'),
      // Required for contextBridge + ipcRenderer to work.
      sandbox: false,
      contextIsolation: true,
    },
    // Don't show until the renderer signals ready-to-show.
    show: false,
  });

  // Show the window once the DOM is ready to avoid visual flicker.
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  // Relay window maximize/restore state to the renderer so the title bar
  // can swap the maximize icon accordingly.
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', true);
  });
  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximizeChange', false);
  });

  // Force external links to open in the system browser, not inside Electron.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
}
