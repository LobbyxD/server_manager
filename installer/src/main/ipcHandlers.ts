/**
 * IPC handlers for the installer.
 * Handles:
 *  - Detecting existing installation via Windows registry
 *  - Installing the bundled app files
 *  - Repairing an existing installation (overwrite files, keep user data)
 *  - Uninstalling (with optional user-data removal)
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_ID   = 'com.danieldev.minecraft-server-manager';
const APP_NAME = 'Minecraft Server Manager';
const PUBLISHER = 'R2D2';
const EXE_NAME  = `${APP_NAME}.exe`;
const UNINSTALL_KEY = `SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_ID}`;
const APPDATA_FOLDER = 'minecraft-server-manager'; // electron-store uses this

// ---------------------------------------------------------------------------
// Registry helpers (uses reg.exe to avoid native-module rebuild complexity)
// ---------------------------------------------------------------------------

function regQuery(key: string, value: string): string | null {
  try {
    const result = execSync(
      `reg query "HKLM\\${key}" /v "${value}" 2>nul`,
      { encoding: 'utf-8', windowsHide: true },
    );
    const match = result.match(/REG_SZ\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function regWrite(key: string, values: Record<string, { type: 'REG_SZ' | 'REG_DWORD'; value: string }>): void {
  execSync(`reg add "HKLM\\${key}" /f`, { windowsHide: true });
  for (const [name, { type, value }] of Object.entries(values)) {
    execSync(
      `reg add "HKLM\\${key}" /v "${name}" /t ${type} /d "${value}" /f`,
      { windowsHide: true },
    );
  }
}

function regDelete(key: string): void {
  try {
    execSync(`reg delete "HKLM\\${key}" /f 2>nul`, { windowsHide: true });
  } catch { /* key didn't exist */ }
}

// ---------------------------------------------------------------------------
// Shortcut helpers (via PowerShell WScript.Shell — no extra npm package)
// ---------------------------------------------------------------------------

function createShortcut(target: string, destination: string, workingDir: string): void {
  const ps = `
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut('${destination.replace(/'/g, "''")}')
$s.TargetPath = '${target.replace(/'/g, "''")}'
$s.WorkingDirectory = '${workingDir.replace(/'/g, "''")}'
$s.IconLocation = '${target.replace(/'/g, "''")}',0
$s.Save()
`.trim();
  execSync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, {
    windowsHide: true,
  });
}

function deleteShortcut(lnkPath: string): void {
  try { fs.unlinkSync(lnkPath); } catch { /* already gone */ }
}

// ---------------------------------------------------------------------------
// File copy with progress
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walkDir(full));
    else files.push(full);
  }
  return files;
}

function copyWithProgress(
  src: string,
  dest: string,
  onProgress: (percent: number, file: string) => void,
): void {
  const files = walkDir(src);
  const total = files.length || 1;
  for (let i = 0; i < files.length; i++) {
    const srcFile  = files[i];
    const rel      = path.relative(src, srcFile);
    const destFile = path.join(dest, rel);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.copyFileSync(srcFile, destFile);
    onProgress(Math.floor(((i + 1) / total) * 100), rel);
  }
}

// ---------------------------------------------------------------------------
// Bundled app source path
// ---------------------------------------------------------------------------

/**
 * In the packaged installer, the main app files live in process.resourcesPath/app/.
 * In dev, fall back to the workspace dist/win-unpacked directory.
 */
function getBundledAppDir(): string {
  if (process.env.NODE_ENV !== 'development') {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, '../../../../dist/win-unpacked');
}

function getBundledVersion(): string {
  try {
    const pkgPath = path.join(getBundledAppDir(), 'resources', 'app', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version ?? '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// ---------------------------------------------------------------------------
// Broadcast progress to renderer
// ---------------------------------------------------------------------------

type ProgressPayload = {
  phase: 'copying' | 'registry' | 'shortcuts' | 'cleanup' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
};

function broadcast(getWin: () => BrowserWindow | null, payload: ProgressPayload): void {
  const w = getWin();
  if (w && !w.isDestroyed()) {
    w.webContents.send('installer:progress', payload);
  }
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerHandlers(getWin: () => BrowserWindow | null): void {

  // --- Detect ---------------------------------------------------------------

  ipcMain.handle('installer:detect', () => {
    const installPath = regQuery(UNINSTALL_KEY, 'InstallLocation');
    if (!installPath) return { installed: false };
    const exeExists = fs.existsSync(path.join(installPath, EXE_NAME));
    if (!exeExists) return { installed: false };
    const installedVersion = regQuery(UNINSTALL_KEY, 'DisplayVersion') ?? undefined;
    return { installed: true, installPath, installedVersion };
  });

  // --- Browse for directory -------------------------------------------------

  ipcMain.handle('installer:browse', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Installation Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // --- Get version of bundled app -------------------------------------------

  ipcMain.handle('installer:getVersion', () => getBundledVersion());

  // --- Install --------------------------------------------------------------

  ipcMain.handle(
    'installer:install',
    async (_event, opts: { installPath: string; desktopShortcut: boolean; startMenuShortcut: boolean }) => {
      const { installPath, desktopShortcut, startMenuShortcut } = opts;
      const push = (p: ProgressPayload) => broadcast(getWin, p);

      try {
        push({ phase: 'copying', percent: 0, message: 'Copying files…' });

        fs.mkdirSync(installPath, { recursive: true });
        const src = getBundledAppDir();

        copyWithProgress(src, installPath, (pct, file) => {
          push({ phase: 'copying', percent: Math.floor(pct * 0.8), message: `Copying ${path.basename(file)}…` });
        });

        push({ phase: 'registry', percent: 80, message: 'Writing registry entries…' });
        const exePath = path.join(installPath, EXE_NAME);
        const version = getBundledVersion();
        regWrite(UNINSTALL_KEY, {
          DisplayName:      { type: 'REG_SZ',    value: APP_NAME },
          DisplayVersion:   { type: 'REG_SZ',    value: version },
          Publisher:        { type: 'REG_SZ',    value: PUBLISHER },
          InstallLocation:  { type: 'REG_SZ',    value: installPath },
          DisplayIcon:      { type: 'REG_SZ',    value: `${exePath},0` },
          UninstallString:  { type: 'REG_SZ',    value: `"${exePath}" --uninstall` },
          NoModify:         { type: 'REG_DWORD', value: '1' },
          NoRepair:         { type: 'REG_DWORD', value: '0' },
        });

        push({ phase: 'shortcuts', percent: 90, message: 'Creating shortcuts…' });

        if (desktopShortcut) {
          const desktop = path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop');
          createShortcut(exePath, path.join(desktop, `${APP_NAME}.lnk`), installPath);
        }

        if (startMenuShortcut) {
          const startMenu = path.join(
            process.env.APPDATA ?? '',
            'Microsoft', 'Windows', 'Start Menu', 'Programs',
          );
          fs.mkdirSync(startMenu, { recursive: true });
          createShortcut(exePath, path.join(startMenu, `${APP_NAME}.lnk`), installPath);
        }

        push({ phase: 'done', percent: 100, message: 'Installation complete!' });
      } catch (err: unknown) {
        push({ phase: 'error', percent: 0, message: 'Installation failed.', error: String(err) });
      }
    },
  );

  // --- Repair ---------------------------------------------------------------

  ipcMain.handle('installer:repair', async () => {
    const push = (p: ProgressPayload) => broadcast(getWin, p);
    try {
      const installPath = regQuery(UNINSTALL_KEY, 'InstallLocation');
      if (!installPath) throw new Error('Installation not found in registry.');

      push({ phase: 'copying', percent: 0, message: 'Repairing — copying files…' });
      const src = getBundledAppDir();
      copyWithProgress(src, installPath, (pct, file) => {
        push({ phase: 'copying', percent: pct, message: `Copying ${path.basename(file)}…` });
      });

      push({ phase: 'done', percent: 100, message: 'Repair complete!' });
    } catch (err: unknown) {
      push({ phase: 'error', percent: 0, message: 'Repair failed.', error: String(err) });
    }
  });

  // --- Uninstall ------------------------------------------------------------

  ipcMain.handle('installer:uninstall', async (_event, { removeData }: { removeData: boolean }) => {
    const push = (p: ProgressPayload) => broadcast(getWin, p);
    try {
      const installPath = regQuery(UNINSTALL_KEY, 'InstallLocation');
      if (!installPath) throw new Error('Installation not found in registry.');

      push({ phase: 'cleanup', percent: 10, message: 'Removing shortcuts…' });

      // Remove shortcuts from known locations.
      const desktop   = path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop');
      const startMenu = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      deleteShortcut(path.join(desktop,   `${APP_NAME}.lnk`));
      deleteShortcut(path.join(startMenu, `${APP_NAME}.lnk`));

      push({ phase: 'cleanup', percent: 30, message: 'Removing registry entries…' });
      regDelete(UNINSTALL_KEY);

      if (removeData) {
        push({ phase: 'cleanup', percent: 50, message: 'Removing user data…' });
        const appData = path.join(process.env.APPDATA ?? '', APPDATA_FOLDER);
        if (fs.existsSync(appData)) fs.rmSync(appData, { recursive: true, force: true });
      }

      push({ phase: 'cleanup', percent: 70, message: 'Removing application files…' });

      // The main exe is running (this installer), so we schedule deletion via cmd.
      // For robustness we delete all files except the installer exe itself.
      // A simple approach: use a bat file that runs after this process exits.
      const batPath = path.join(installPath, '__uninstall__.bat');
      const batContent = [
        '@echo off',
        'timeout /t 2 /nobreak >nul',
        `rd /s /q "${installPath}"`,
        'del "%~f0"',
      ].join('\r\n');
      fs.writeFileSync(batPath, batContent);
      execSync(`start "" /min "${batPath}"`, { windowsHide: true, detached: true } as never);

      push({ phase: 'done', percent: 100, message: 'Uninstall complete.' });
    } catch (err: unknown) {
      push({ phase: 'error', percent: 0, message: 'Uninstall failed.', error: String(err) });
    }
  });

  // --- Open folder ----------------------------------------------------------

  ipcMain.handle('installer:openFolder', (_event, folderPath: string) => {
    try { execSync(`explorer "${folderPath}"`, { windowsHide: false }); } catch { /* ignore */ }
  });
}
