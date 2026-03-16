/**
 * World backup management for Minecraft servers.
 *
 * Backups are stored as zip archives in a "World Backups" folder
 * inside the server directory, using PowerShell + .NET ZipFile for
 * Optimal compression without any external npm dependencies.
 *
 * Archive layout: the world folder is stored at the zip root so that
 * Expand-Archive restores it directly under the server directory.
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { BackupEntry } from '../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getServerDir(batPath: string): string {
  return path.dirname(batPath);
}

/** Reads level-name from server.properties, defaults to "world". */
export function getLevelName(serverDir: string): string {
  try {
    const propsPath = path.join(serverDir, 'server.properties');
    const content = fs.readFileSync(propsPath, 'utf-8');
    const match = content.match(/^level-name\s*=\s*(.+)$/m);
    return match ? match[1].trim() : 'world';
  } catch {
    return 'world';
  }
}

function getBackupDir(serverDir: string): string {
  return path.join(serverDir, 'World Backups');
}

/** Escapes single quotes for safe use in PowerShell single-quoted strings. */
function ps(s: string): string {
  return s.replace(/'/g, "''");
}

/** Runs a PowerShell command asynchronously and resolves/rejects on exit. */
function runPowerShell(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', command],
      { windowsHide: true },
    );

    let stderr = '';
    proc.stderr?.setEncoding('utf8');
    proc.stderr?.on('data', (d: string) => { stderr += d; });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

/** Deletes oldest zip files in backupDir until files.length <= limit. */
function enforceBackupLimit(backupDir: string, limit: number): void {
  if (limit <= 0) return;
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => ({ f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  while (files.length > limit) {
    fs.unlinkSync(path.join(backupDir, files.pop()!.f));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Returns a sorted (newest first) list of backup archives for the given server. */
export function listBackups(batPath: string): BackupEntry[] {
  const backupDir = getBackupDir(getServerDir(batPath));
  if (!fs.existsSync(backupDir)) return [];

  return fs
    .readdirSync(backupDir)
    .filter((f) => f.endsWith('.zip'))
    .map((f) => {
      const fullPath = path.join(backupDir, f);
      const stat = fs.statSync(fullPath);
      return {
        filename: f,
        fullPath,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Creates a zip backup of the server's world folder.
 * Uses .NET System.IO.Compression.ZipFile with CompressionLevel.Optimal.
 * Enforces backupLimit by deleting the oldest archive(s) after creation.
 * Returns the metadata of the newly created archive.
 */
export async function createBackup(batPath: string, backupLimit: number): Promise<BackupEntry> {
  const serverDir = getServerDir(batPath);
  const levelName = getLevelName(serverDir);
  const worldPath = path.join(serverDir, levelName);

  if (!fs.existsSync(worldPath)) {
    throw new Error(`World folder "${levelName}" not found in server directory.`);
  }

  const backupDir = getBackupDir(serverDir);
  fs.mkdirSync(backupDir, { recursive: true });

  // Timestamp: 2026-03-16_14-30-00
  const ts = new Date()
    .toISOString()
    .replace('T', '_')
    .replace(/:/g, '-')
    .slice(0, 19);
  const filename = `${ts}_${levelName}.zip`;
  const backupPath = path.join(backupDir, filename);

  // includeBaseDirectory = $true → world/ folder is at the zip root,
  // so Expand-Archive restores it correctly under serverDir.
  const psCmd =
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; ` +
    `[System.IO.Compression.ZipFile]::CreateFromDirectory(` +
    `'${ps(worldPath)}', '${ps(backupPath)}', ` +
    `[System.IO.Compression.CompressionLevel]::Optimal, $true)`;

  await runPowerShell(psCmd);

  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup creation failed: archive not found after compression.');
  }

  enforceBackupLimit(backupDir, backupLimit);

  const stat = fs.statSync(backupPath);
  return { filename, fullPath: backupPath, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
}

/**
 * Restores a backup by replacing the world folder with the contents of the zip.
 * The server MUST be stopped before calling this.
 */
export async function restoreBackup(batPath: string, backupFilePath: string): Promise<void> {
  const serverDir = getServerDir(batPath);
  const levelName = getLevelName(serverDir);
  const worldPath = path.join(serverDir, levelName);

  // Remove the existing world folder before extracting.
  if (fs.existsSync(worldPath)) {
    fs.rmSync(worldPath, { recursive: true, force: true });
  }

  // Expand-Archive -Force overwrites any existing files during extraction.
  const psCmd =
    `Expand-Archive -LiteralPath '${ps(backupFilePath)}' ` +
    `-DestinationPath '${ps(serverDir)}' -Force`;

  await runPowerShell(psCmd);
}

/** Permanently deletes a single backup archive. */
export function deleteBackup(backupFilePath: string): void {
  fs.unlinkSync(backupFilePath);
}
