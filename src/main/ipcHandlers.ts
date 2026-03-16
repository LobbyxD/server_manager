/**
 * Registers all ipcMain handlers that the renderer can invoke through
 * the preload's contextBridge API.
 *
 * A Map<serverId, ServerProcess> tracks all live server processes so that
 * log events and status changes can be broadcast to the renderer.
 */

import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { ServerProcess } from './serverProcess';
import { getServers, setServers, getSettings, setSettings, getRunningPids, setRunningPid, clearRunningPid } from './store';
import { IPC, LogLine, ServerProfile } from '../shared/types';
import { unlockAchievement, ACH } from './steam';
import { createBackup, listBackups, restoreBackup, deleteBackup } from './backupManager';

/** Live process registry keyed by server profile ID. */
const processes = new Map<string, ServerProcess>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Returns the existing ServerProcess for the given ID, or creates a new one
 * and wires up its events to broadcast to all renderer windows.
 */
function getOrCreate(id: string): ServerProcess {
  if (processes.has(id)) return processes.get(id)!;

  const proc = new ServerProcess(id);
  processes.set(id, proc);

  proc.on('log', (line: LogLine) => {
    broadcast(IPC.LOG_LINE, id, line);
  });

  proc.on('started', () => {
    // Persist the cmd.exe PID so it can be found even after an app restart.
    if (proc.pid) setRunningPid(id, proc.pid);
    broadcast(IPC.SERVER_STATUS_CHANGE, id, 'running');
  });

  proc.on('stopped', () => {
    clearRunningPid(id);
    broadcast(IPC.SERVER_STATUS_CHANGE, id, 'stopped');

    // Auto-backup: runs asynchronously so it doesn't block the stopped event.
    const profile = getServers().find((s) => s.id === id);
    if (profile?.autoBackup) {
      const limit = getSettings().backupLimit ?? 5;
      broadcast(IPC.LOG_LINE, id, {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        text: '[Manager] Auto-backup: creating world backup...',
        type: 'out',
      } satisfies LogLine);

      createBackup(profile.batPath, limit)
        .then((entry) => {
          broadcast(IPC.LOG_LINE, id, {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            text: `[Manager] Auto-backup saved: ${entry.filename} (${(entry.sizeBytes / 1024 / 1024).toFixed(1)} MB)`,
            type: 'out',
          } satisfies LogLine);
        })
        .catch((err: Error) => {
          broadcast(IPC.LOG_LINE, id, {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            text: `[Manager] Auto-backup failed: ${err.message}`,
            type: 'err',
          } satisfies LogLine);
        });
    }
  });

  proc.on('error', (err: Error) => {
    broadcast(IPC.SERVER_STATUS_CHANGE, id, 'error');
    broadcast(IPC.LOG_LINE, id, {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      text: `[PROCESS ERROR] ${err.message}`,
      type: 'err',
    } satisfies LogLine);
  });

  return proc;
}

/**
 * Returns true if the given PID is still alive without sending a signal.
 * Uses process.kill(pid, 0) which throws if the PID is dead.
 */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kills a process tree by PID using taskkill /F /T (synchronous).
 * No-ops on non-Windows platforms.
 */
function killByPid(pid: number): void {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
  } else {
    try { process.kill(pid, 'SIGKILL'); } catch { /* already dead */ }
  }
}

/** Sends an IPC push event to every open BrowserWindow. */
function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

/** Resolves a stored profile by ID, throwing if not found. */
function requireProfile(id: string): ServerProfile {
  const profile = getServers().find((s) => s.id === id);
  if (!profile) throw new Error(`Server profile not found: ${id}`);
  return profile;
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerIpcHandlers(): void {
  // --- Server lifecycle -------------------------------------------------

  ipcMain.handle(IPC.SERVER_START, async (_event, id: string) => {
    const settings = getSettings();
    const limit = settings.maxConcurrentServers ?? 1;
    const runningCount = [...processes.values()].filter((p) => p.isRunning).length;
    if (runningCount >= limit) {
      throw new Error(
        `SERVER_LIMIT: Server limit reached (${runningCount}/${limit} running). Stop a server first or raise the limit in Settings.`,
      );
    }
    const willBeMultitasking = runningCount >= 1;
    const profile = requireProfile(id);
    const proc = getOrCreate(id);
    proc.once('started', () => {
      unlockAchievement(ACH.FIRST_SERVER);
      if (willBeMultitasking) unlockAchievement(ACH.MULTITASKER);
    });
    proc.spawn(profile.batPath);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_STOP, async (_event, id: string) => {
    const proc = processes.get(id);
    if (proc?.isRunning) proc.stop();
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_RESTART, async (_event, id: string) => {
    const profile = requireProfile(id);
    const proc = getOrCreate(id);
    await proc.restart(profile.batPath);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_COMMAND, async (_event, id: string, cmd: string) => {
    const proc = processes.get(id);
    if (proc?.isRunning) proc.sendCommand(cmd);
    const trimmed = cmd.trim();
    if (trimmed.startsWith('ban '))       unlockAchievement(ACH.BAN_HAMMER);
    else if (trimmed.startsWith('op '))   unlockAchievement(ACH.OP_GRANTED);
    else if (trimmed === 'whitelist on')  unlockAchievement(ACH.WHITELIST);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_FORCE_KILL, async (_event, id: string) => {
    // Kill the currently-tracked process (if this session started it).
    const proc = processes.get(id);
    if (proc?.isRunning) {
      proc.forceKill();
    }
    // Also kill any orphaned process from a previous session via stored PID.
    const storedPid = getRunningPids()[id];
    if (storedPid && isPidAlive(storedPid)) {
      killByPid(storedPid);
    }
    clearRunningPid(id);
    broadcast(IPC.SERVER_STATUS_CHANGE, id, 'stopped');
    unlockAchievement(ACH.FORCE_KILLER);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_STATUS, async (_event, id: string) => {
    const proc = processes.get(id);
    return proc?.isRunning ? 'running' : 'stopped';
  });

  ipcMain.handle(IPC.SERVER_ALL_STATUS, async () => {
    const statuses: Record<string, string> = {};
    processes.forEach((proc, id) => {
      statuses[id] = proc.isRunning ? 'running' : 'stopped';
    });
    return statuses;
  });

  // --- Profiles ---------------------------------------------------------

  ipcMain.handle(IPC.PROFILES_LIST, async () => getServers());

  ipcMain.handle(
    IPC.PROFILES_ADD,
    async (_event, profile: Omit<ServerProfile, 'id'>) => {
      const servers = getServers();
      const newProfile: ServerProfile = {
        ...profile,
        id: crypto.randomUUID(),
      };
      setServers([...servers, newProfile]);
      return newProfile;
    },
  );

  ipcMain.handle(IPC.PROFILES_UPDATE, async (_event, profile: ServerProfile) => {
    const updated = getServers().map((s) => (s.id === profile.id ? profile : s));
    setServers(updated);
    return profile;
  });

  ipcMain.handle(IPC.PROFILES_DELETE, async (_event, id: string) => {
    const proc = processes.get(id);
    if (proc?.isRunning) proc.forceKill();
    processes.delete(id);
    setServers(getServers().filter((s) => s.id !== id));
    return { success: true };
  });

  // --- Settings ---------------------------------------------------------

  ipcMain.handle(IPC.SETTINGS_GET, async () => getSettings());

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, patch) => setSettings(patch));

  // --- BAT file editor --------------------------------------------------

  ipcMain.handle(IPC.BAT_READ, async (_event, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });

  ipcMain.handle(IPC.BAT_WRITE, async (_event, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  });

  // --- File dialog ------------------------------------------------------

  ipcMain.handle(IPC.DIALOG_OPEN_BAT, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Server Start Script',
      filters: [{ name: 'Batch / Command Files', extensions: ['bat', 'cmd'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_event, title?: string) => {
    const result = await dialog.showOpenDialog({
      title: title ?? 'Select File',
      filters: [{ name: 'Text Files', extensions: ['txt', 'properties', 'cfg', 'conf', 'json', 'yaml', 'yml'] }, { name: 'All Files', extensions: ['*'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(IPC.SHELL_OPEN_FOLDER, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
    return { success: true };
  });

  // --- Backup -----------------------------------------------------------

  ipcMain.handle(IPC.BACKUP_LIST, async (_event, id: string) => {
    const profile = requireProfile(id);
    return listBackups(profile.batPath);
  });

  ipcMain.handle(IPC.BACKUP_CREATE, async (_event, id: string) => {
    const profile = requireProfile(id);
    const limit = getSettings().backupLimit ?? 5;
    return createBackup(profile.batPath, limit);
  });

  ipcMain.handle(IPC.BACKUP_RESTORE, async (_event, id: string, backupFilePath: string) => {
    const proc = processes.get(id);
    if (proc?.isRunning) {
      throw new Error('Stop the server before restoring a backup.');
    }
    const profile = requireProfile(id);
    await restoreBackup(profile.batPath, backupFilePath);
    return { success: true };
  });

  ipcMain.handle(IPC.BACKUP_DELETE, async (_event, _id: string, backupFilePath: string) => {
    deleteBackup(backupFilePath);
    return { success: true };
  });

  ipcMain.handle(IPC.BACKUP_OPEN_FOLDER, async (_event, id: string) => {
    const profile = requireProfile(id);
    const serverDir = path.dirname(profile.batPath);
    const backupDir = path.join(serverDir, 'World Backups');
    fs.mkdirSync(backupDir, { recursive: true });
    await shell.openPath(backupDir);
    return { success: true };
  });
}

// ---------------------------------------------------------------------------
// Startup / shutdown helpers called from index.ts
// ---------------------------------------------------------------------------

/**
 * Spawns all profiles that have autoStart enabled.
 * Skips any server whose PID from a previous session is still alive to
 * prevent double-starting when the app is restarted while servers are running.
 */
export function startAutoStartServers(): void {
  const storedPids = getRunningPids();
  for (const profile of getServers()) {
    if (!profile.autoStart) continue;

    // Check if a process from the previous app session is still alive.
    const orphanPid = storedPids[profile.id];
    if (orphanPid && isPidAlive(orphanPid)) {
      console.log(`[AutoStart] Skipping "${profile.name}" – previous process PID ${orphanPid} is still alive.`);
      // Report it as running so the UI reflects the correct state.
      broadcast(IPC.SERVER_STATUS_CHANGE, profile.id, 'running');
      continue;
    }

    const proc = getOrCreate(profile.id);
    if (!proc.isRunning) {
      proc.spawn(profile.batPath);
    }
  }
}

/** Force-kills every running server process. Called before app quit. */
export function stopAllServers(): void {
  processes.forEach((proc) => {
    if (proc.isRunning) proc.forceKill();
  });
}

/**
 * Returns the display names of all currently-running servers.
 * Used by the quit dialog to show the user which servers are still active.
 */
export function getRunningServerNames(): string[] {
  const names: string[] = [];
  for (const [id, proc] of processes) {
    if (proc.isRunning) {
      const profile = getServers().find((s) => s.id === id);
      names.push(profile?.name ?? id);
    }
  }
  return names;
}

/**
 * Sends a graceful 'stop' command to every running server and resolves once
 * they have all emitted 'stopped' (or after a 30-second per-server timeout).
 */
export function stopAllServersSafe(): Promise<void> {
  const running = [...processes.values()].filter((p) => p.isRunning);
  if (running.length === 0) return Promise.resolve();

  return Promise.all(
    running.map(
      (proc) =>
        new Promise<void>((resolve) => {
          let timer: ReturnType<typeof setTimeout>;
          proc.once('stopped', () => {
            clearTimeout(timer);
            resolve();
          });
          proc.stop();
          // Safety net: force-resolve after 30 s so the app can always quit.
          timer = setTimeout(resolve, 30_000);
        }),
    ),
  ).then(() => undefined);
}
