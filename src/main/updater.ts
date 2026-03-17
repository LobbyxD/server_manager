/**
 * Auto-update via GitHub Releases.
 *
 * Does NOT depend on electron-updater or app-update.yml.
 * Fetches the latest release from the GitHub API, compares versions,
 * downloads the installer EXE with progress, then launches it with
 * --update so it installs silently without showing the installer UI.
 *
 * Flow:
 *  1. checkForUpdatesOnLaunch() runs 3 s after window ready (non-blocking).
 *  2. User can also trigger a manual check via Settings → Check for Updates.
 *  3. When available: renderer shows UpdateDialog (Update Now / Later).
 *  4. "Update Now" → downloadUpdate() streams EXE to %TEMP% with % progress.
 *  5. Download complete → installUpdate() spawns installer --update, app quits.
 */

import { app, ipcMain, BrowserWindow } from 'electron';
import https from 'https';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { IPC, UpdaterStatus } from '../shared/types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GITHUB_OWNER = 'LobbyxD';
const GITHUB_REPO  = 'server_manager';
const API_URL      = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcast(status: UpdaterStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATER_STATUS, status);
  }
}

/** Returns 1 if a > b, -1 if a < b, 0 if equal (semver, ignores pre-release). */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** HTTPS GET that follows redirects and returns the body as a string. */
function httpsGetText(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      const parsed = new URL(u);
      https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: {
            'User-Agent': 'MinecraftServerManager-AutoUpdater',
            Accept: 'application/vnd.github+json',
          },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return follow(res.headers.location!);
          }
          let body = '';
          res.on('data', (c: Buffer) => { body += c; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
          res.on('error', reject);
        },
      ).on('error', reject);
    };
    follow(url);
  });
}

/** Downloads a URL to a file path, calling onProgress(0-100) as bytes arrive. */
function downloadFile(
  url: string,
  dest: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      const parsed = new URL(u);
      https.get(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'MinecraftServerManager-AutoUpdater' },
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return follow(res.headers.location!);
          }
          if (res.statusCode !== 200) {
            return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          }

          const total = parseInt(res.headers['content-length'] ?? '0', 10);
          let received = 0;

          const file = fs.createWriteStream(dest);

          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (total > 0) onProgress(Math.floor((received / total) * 100));
          });

          res.pipe(file);
          file.on('finish', () => file.close(() => resolve()));
          file.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
          res.on('error', reject);
        },
      ).on('error', reject);
    };
    follow(url);
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let latestRelease: { version: string; downloadUrl: string } | null = null;
let downloadedPath: string | null = null;

// ---------------------------------------------------------------------------
// Core operations
// ---------------------------------------------------------------------------

async function checkForUpdates(): Promise<void> {
  broadcast({ state: 'checking' });
  try {
    const { status, body } = await httpsGetText(API_URL);
    if (status !== 200) throw new Error(`GitHub API returned HTTP ${status}`);

    const data = JSON.parse(body);
    const latestVersion  = (data.tag_name as string).replace(/^v/, '');
    const currentVersion = app.getVersion();

    if (compareVersions(latestVersion, currentVersion) > 0) {
      // Find the first .exe asset in the release
      const asset = (data.assets as Array<{ name: string; browser_download_url: string }>)
        .find((a) => a.name.endsWith('.exe'));
      if (!asset) throw new Error('No installer EXE found in release assets');

      latestRelease = { version: latestVersion, downloadUrl: asset.browser_download_url };
      broadcast({ state: 'available', version: latestVersion });
    } else {
      broadcast({ state: 'not-available' });
    }
  } catch (err: unknown) {
    broadcast({ state: 'error', error: (err as Error).message });
  }
}

async function downloadUpdate(): Promise<void> {
  if (!latestRelease) return;
  const { version, downloadUrl } = latestRelease;

  broadcast({ state: 'downloading', version, percent: 0 });

  try {
    const dest = path.join(os.tmpdir(), `MSM-Setup-${version}.exe`);

    await downloadFile(downloadUrl, dest, (pct) => {
      broadcast({ state: 'downloading', version, percent: pct });
    });

    downloadedPath = dest;
    broadcast({ state: 'ready', version });
  } catch (err: unknown) {
    broadcast({ state: 'error', error: (err as Error).message });
  }
}

function installUpdate(): void {
  if (!downloadedPath) return;
  // Run the installer with --update so it installs silently without UI.
  spawn(downloadedPath, ['--update'], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function setupUpdater(): void {
  ipcMain.handle(IPC.UPDATER_CHECK, async () => {
    await checkForUpdates();
  });

  ipcMain.handle(IPC.UPDATER_DOWNLOAD, async () => {
    await downloadUpdate();
  });

  ipcMain.handle(IPC.UPDATER_INSTALL, () => {
    installUpdate();
  });
}

/**
 * Non-blocking background check 3 s after the window is ready.
 * Errors are swallowed so a failed network call never shows on every launch.
 */
export function checkForUpdatesOnLaunch(): void {
  if (!app.isPackaged) return;
  setTimeout(() => {
    checkForUpdates().catch(() => { /* silently ignore */ });
  }, 3000);
}
