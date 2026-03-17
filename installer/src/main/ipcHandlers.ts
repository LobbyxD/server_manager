/**
 * IPC handlers for the custom installer.
 * All registry operations use PowerShell to avoid reg.exe stderr/stdout
 * parsing issues and to get reliable results on all Windows versions.
 */

import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import * as fs from 'original-fs'; // bypass Electron's asar-patched fs for file copy ops
import path from 'path';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const APP_ID        = 'com.danieldev.minecraft-server-manager';
const APP_NAME      = 'Minecraft Server Manager';
const PUBLISHER     = 'R2D2';
const EXE_NAME      = `${APP_NAME}.exe`;
const REG_BASE_LM   = `HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall`;
const REG_BASE_CU   = `HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall`;
const REG_BASE      = REG_BASE_LM; // default for writes
const APPDATA_DIR   = 'minecraft-server-manager'; // electron-store folder name

// ---------------------------------------------------------------------------
// PowerShell helper — runs a one-liner, returns trimmed stdout or null
// ---------------------------------------------------------------------------

function ps(command: string): string | null {
  try {
    const result = execSync(
      `powershell -NoProfile -NonInteractive -Command "${command.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const out = result.trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detection — checks registry first, then falls back to well-known paths
// ---------------------------------------------------------------------------

interface DetectResult {
  installed: boolean;
  installPath?: string;
  installedVersion?: string;
}

function detectInstallation(): DetectResult {
  // 1. Our own registry key — check both HKLM and HKCU
  for (const base of [REG_BASE_LM, REG_BASE_CU]) {
    const ownPath = ps(
      `(Get-ItemProperty -Path '${base}\\${APP_ID}' -ErrorAction SilentlyContinue).InstallLocation`,
    );
    if (ownPath && fs.existsSync(path.join(ownPath, EXE_NAME))) {
      const ver = ps(
        `(Get-ItemProperty -Path '${base}\\${APP_ID}' -ErrorAction SilentlyContinue).DisplayVersion`,
      ) ?? undefined;
      return { installed: true, installPath: ownPath, installedVersion: ver };
    }
  }

  // 2. Scan ALL uninstall keys for our display name — both HKLM and HKCU
  for (const base of [REG_BASE_LM, REG_BASE_CU]) {
    const anyPath = ps(
      `(Get-ItemProperty '${base}\\*' -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.DisplayName -eq '${APP_NAME}' } | ` +
      `Select-Object -First 1 -ExpandProperty InstallLocation)`,
    );
    if (anyPath && fs.existsSync(path.join(anyPath, EXE_NAME))) {
      return { installed: true, installPath: anyPath, installedVersion: undefined };
    }
  }

  // 3. Well-known filesystem paths
  const drive = process.env.SystemDrive ?? 'C:';
  const localAppData = process.env.LOCALAPPDATA ?? '';
  const candidates = [
    path.join(drive,                                   APP_NAME),
    path.join(process.env.ProgramFiles ?? '',          APP_NAME),
    path.join(process.env['ProgramFiles(x86)'] ?? '',  APP_NAME),
    path.join(localAppData,                            APP_NAME),
    path.join(localAppData, 'Programs',                APP_NAME),
  ];
  for (const p of candidates) {
    if (p && fs.existsSync(path.join(p, EXE_NAME))) {
      return { installed: true, installPath: p, installedVersion: undefined };
    }
  }

  return { installed: false };
}

// ---------------------------------------------------------------------------
// Registry write / delete
// ---------------------------------------------------------------------------

function writeRegistry(installPath: string, version: string): void {
  const exePath = path.join(installPath, EXE_NAME);
  const cmds = [
    `$k = '${REG_BASE}\\${APP_ID}'`,
    `New-Item -Path $k -Force | Out-Null`,
    `Set-ItemProperty -Path $k -Name DisplayName      -Value '${APP_NAME}'`,
    `Set-ItemProperty -Path $k -Name DisplayVersion   -Value '${version}'`,
    `Set-ItemProperty -Path $k -Name Publisher        -Value '${PUBLISHER}'`,
    `Set-ItemProperty -Path $k -Name InstallLocation  -Value '${installPath}'`,
    `Set-ItemProperty -Path $k -Name DisplayIcon      -Value '${exePath},0'`,
    `Set-ItemProperty -Path $k -Name UninstallString  -Value '"${exePath}" --uninstall'`,
    `Set-ItemProperty -Path $k -Name NoModify         -Value 1 -Type DWord`,
    `Set-ItemProperty -Path $k -Name NoRepair         -Value 0 -Type DWord`,
  ].join('; ');
  ps(cmds);
}

function deleteRegistry(): void {
  for (const base of [REG_BASE_LM, REG_BASE_CU]) {
    ps(`Remove-Item -Path '${base}\\${APP_ID}' -Recurse -Force -ErrorAction SilentlyContinue`);
  }
}

// ---------------------------------------------------------------------------
// Shortcut helpers via PowerShell WScript.Shell
// ---------------------------------------------------------------------------

function createShortcut(target: string, dest: string, workDir: string): void {
  const cmd = [
    `$ws = New-Object -ComObject WScript.Shell`,
    `$s = $ws.CreateShortcut('${dest}')`,
    `$s.TargetPath = '${target}'`,
    `$s.WorkingDirectory = '${workDir}'`,
    `$s.IconLocation = '${target},0'`,
    `$s.Save()`,
  ].join('; ');
  ps(cmd);
}

function deleteShortcutIfExists(lnkPath: string): void {
  try { if (fs.existsSync(lnkPath)) fs.unlinkSync(lnkPath); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// File-copy with per-file progress callbacks
// ---------------------------------------------------------------------------

function walkDir(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(full));
    else out.push(full);
  }
  return out;
}

function copyTree(
  src: string,
  dest: string,
  onProgress: (pct: number, name: string) => void,
): void {
  const files = walkDir(src);
  const total = Math.max(files.length, 1);
  for (let i = 0; i < files.length; i++) {
    const rel  = path.relative(src, files[i]);
    const out  = path.join(dest, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(files[i], out);
    onProgress(Math.floor(((i + 1) / total) * 100), path.basename(files[i]));
  }
}

// ---------------------------------------------------------------------------
// Bundled app source & version
// ---------------------------------------------------------------------------

function getBundledAppDir(): string {
  if (process.env.NODE_ENV === 'development') {
    return path.join(__dirname, '../../../../dist/win-unpacked');
  }
  return path.join(process.resourcesPath, 'app');
}

function getBundledVersion(): string {
  // Use the installer's own version — kept in sync with the main app.
  return app.getVersion();
}

// ---------------------------------------------------------------------------
// Progress broadcast
// ---------------------------------------------------------------------------

type Phase = 'copying' | 'registry' | 'shortcuts' | 'cleanup' | 'done' | 'error';

interface ProgressPayload {
  phase: Phase;
  percent: number;
  message: string;
  error?: string;
}

function broadcast(getWin: () => BrowserWindow | null, p: ProgressPayload): void {
  const w = getWin();
  if (w && !w.isDestroyed()) w.webContents.send('installer:progress', p);
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerHandlers(getWin: () => BrowserWindow | null): void {

  // Detect existing installation
  ipcMain.handle('installer:detect', () => detectInstallation());

  // Directory picker
  ipcMain.handle('installer:browse', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose Installation Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled ? null : res.filePaths[0];
  });

  // Version of the bundled app
  ipcMain.handle('installer:getVersion', () => getBundledVersion());

  // Default install path (system drive + app name)
  ipcMain.handle('installer:getDefaultPath', () => {
    const drive = process.env.SystemDrive ?? 'C:';
    return path.join(drive, APP_NAME);
  });

  // ── INSTALL ──────────────────────────────────────────────────────────────

  ipcMain.handle(
    'installer:install',
    (_event, opts: { installPath: string; desktopShortcut: boolean; startMenuShortcut: boolean }) => {
      const push = (p: ProgressPayload) => broadcast(getWin, p);
      const { installPath, desktopShortcut, startMenuShortcut } = opts;

      try {
        push({ phase: 'copying', percent: 0, message: 'Copying files…' });

        fs.mkdirSync(installPath, { recursive: true });
        copyTree(getBundledAppDir(), installPath, (pct, name) => {
          push({ phase: 'copying', percent: Math.floor(pct * 0.80), message: `Copying ${name}…` });
        });

        push({ phase: 'registry', percent: 82, message: 'Writing registry…' });
        writeRegistry(installPath, getBundledVersion());

        push({ phase: 'shortcuts', percent: 90, message: 'Creating shortcuts…' });
        const exePath = path.join(installPath, EXE_NAME);

        if (desktopShortcut) {
          const desktop = path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop');
          createShortcut(exePath, path.join(desktop, `${APP_NAME}.lnk`), installPath);
        }
        if (startMenuShortcut) {
          const sm = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
          fs.mkdirSync(sm, { recursive: true });
          createShortcut(exePath, path.join(sm, `${APP_NAME}.lnk`), installPath);
        }

        push({ phase: 'done', percent: 100, message: 'Installation complete!' });
      } catch (err) {
        push({ phase: 'error', percent: 0, message: 'Installation failed.', error: String(err) });
      }
    },
  );

  // ── REPAIR ───────────────────────────────────────────────────────────────

  ipcMain.handle('installer:repair', () => {
    const push = (p: ProgressPayload) => broadcast(getWin, p);

    try {
      const detected = detectInstallation();
      if (!detected.installed || !detected.installPath) {
        throw new Error('No installation found to repair.');
      }

      push({ phase: 'copying', percent: 0, message: 'Overwriting files…' });
      copyTree(getBundledAppDir(), detected.installPath, (pct, name) => {
        push({ phase: 'copying', percent: pct, message: `Copying ${name}…` });
      });

      // Refresh the registry version entry
      push({ phase: 'registry', percent: 98, message: 'Updating registry…' });
      writeRegistry(detected.installPath, getBundledVersion());

      push({ phase: 'done', percent: 100, message: 'Repair complete!' });
    } catch (err) {
      push({ phase: 'error', percent: 0, message: 'Repair failed.', error: String(err) });
    }
  });

  // ── UNINSTALL ─────────────────────────────────────────────────────────────

  ipcMain.handle('installer:uninstall', (_event, { removeData }: { removeData: boolean }) => {
    const push = (p: ProgressPayload) => broadcast(getWin, p);

    try {
      const detected = detectInstallation();
      if (!detected.installed || !detected.installPath) {
        throw new Error('No installation found.');
      }
      const installPath = detected.installPath;

      push({ phase: 'cleanup', percent: 10, message: 'Removing shortcuts…' });
      const desktop = path.join(process.env.PUBLIC ?? 'C:\\Users\\Public', 'Desktop');
      const sm      = path.join(process.env.APPDATA ?? '', 'Microsoft', 'Windows', 'Start Menu', 'Programs');
      deleteShortcutIfExists(path.join(desktop, `${APP_NAME}.lnk`));
      deleteShortcutIfExists(path.join(sm,      `${APP_NAME}.lnk`));

      push({ phase: 'cleanup', percent: 30, message: 'Removing registry entries…' });
      deleteRegistry();

      if (removeData) {
        push({ phase: 'cleanup', percent: 50, message: 'Removing user data…' });
        const data = path.join(process.env.APPDATA ?? '', APPDATA_DIR);
        if (fs.existsSync(data)) fs.rmSync(data, { recursive: true, force: true });
      }

      push({ phase: 'cleanup', percent: 70, message: 'Removing application files…' });

      // Delete install folder directly (we're a separate process so no files are locked by us).
      // Fall back to a detached bat only if direct deletion fails (e.g. user has app open).
      try {
        fs.rmSync(installPath, { recursive: true, force: true });
      } catch {
        const bat = path.join(require('os').tmpdir(), '__msm_uninstall__.bat');
        fs.writeFileSync(bat, [
          '@echo off',
          'timeout /t 3 /nobreak >nul',
          `rd /s /q "${installPath}"`,
          `del "%~f0"`,
        ].join('\r\n'));
        const { spawn } = require('child_process');
        spawn('cmd.exe', ['/c', bat], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
      }

      push({ phase: 'done', percent: 100, message: 'Uninstalled successfully.' });
    } catch (err) {
      push({ phase: 'error', percent: 0, message: 'Uninstall failed.', error: String(err) });
    }
  });

  // Open a folder in Explorer
  ipcMain.handle('installer:openFolder', (_event, folderPath: string) => {
    const { spawn } = require('child_process');
    spawn('explorer.exe', [folderPath], { detached: true, windowsHide: false }).unref();
  });
}
