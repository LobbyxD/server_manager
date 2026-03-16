/**
 * System tray icon and context menu.
 * Clicking the tray icon toggles window visibility.
 * The tray is created once and persists for the app lifetime.
 */

import { Tray, Menu, nativeImage, app } from 'electron';
import { join } from 'path';
import { mainWindow } from './window';

let tray: Tray | null = null;

/**
 * A minimal valid 16x16 solid green (#4ade80) PNG encoded as base64.
 * Used as a fallback tray icon when no resources/icon.ico is present.
 * (Replace resources/icon.ico with a proper 256x256 .ico for production.)
 */
const FALLBACK_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4jWNg' +
  'YPj/nwEHYBi1gIFgCxj+M+ACjEM0TBw1YNSAUQNGGo8aAABLkAABKkGktwAAAABJRU5ErkJggg==';

/** Loads the app icon, falling back to a small generated icon if the file is missing. */
function loadIcon(): Electron.NativeImage {
  // Prefer a bundled .ico for the best Windows tray experience.
  const icoPaths = [
    join(__dirname, '../../resources/icon.ico'),
    join(__dirname, '../../resources/icon.png'),
  ];
  for (const p of icoPaths) {
    try {
      const icon = nativeImage.createFromPath(p);
      if (!icon.isEmpty()) return icon;
    } catch {
      // File missing – try next.
    }
  }
  // Last resort: an embedded 16x16 PNG icon.
  return nativeImage.createFromDataURL(`data:image/png;base64,${FALLBACK_ICON_B64}`);
}

function buildContextMenu(onQuit: () => void): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: 'Open Minecraft Server Manager',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: onQuit,
    },
  ]);
}

export function createTray(onQuit: () => void): void {
  try {
    tray = new Tray(loadIcon());
  } catch (err) {
    console.error('[Tray] Failed to create system tray icon:', err);
    return;
  }
  tray.setToolTip('Minecraft Server Manager');
  tray.setContextMenu(buildContextMenu(onQuit));

  // Single left-click toggles the window.
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
