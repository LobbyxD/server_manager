/**
 * Persistent storage layer using electron-store (v8, CJS-compatible).
 * Provides typed getters and setters for server profiles and app settings.
 */

import Store from 'electron-store';
import { ServerProfile, AppSettings } from '../shared/types';

interface StoreSchema {
  servers: ServerProfile[];
  settings: AppSettings;
  /**
   * Maps serverId → the cmd.exe PID that was spawned for it.
   * Persisted across app restarts so orphaned processes from crashed/closed
   * sessions can be detected and killed on the next launch.
   */
  runningPids: Record<string, number>;
}

const defaults: StoreSchema = {
  servers: [],
  settings: {
    theme: 'dark',
    minimizeToTray: true,
    fontSize: 13,
    maxConcurrentServers: 1,
    debugMode: false,
  },
  runningPids: {},
};

export const store = new Store<StoreSchema>({ defaults });

// ---------------------------------------------------------------------------
// Server profiles
// ---------------------------------------------------------------------------

export function getServers(): ServerProfile[] {
  return store.get('servers');
}

export function setServers(servers: ServerProfile[]): void {
  store.set('servers', servers);
}

// ---------------------------------------------------------------------------
// App settings
// ---------------------------------------------------------------------------

export function getSettings(): AppSettings {
  return store.get('settings');
}

/**
 * Merges a partial settings patch into the stored settings and returns the
 * full updated settings object.
 */
export function setSettings(patch: Partial<AppSettings>): AppSettings {
  const current = store.get('settings');
  const updated: AppSettings = { ...current, ...patch };
  store.set('settings', updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Running PID registry
// ---------------------------------------------------------------------------

export function getRunningPids(): Record<string, number> {
  return store.get('runningPids');
}

export function setRunningPid(serverId: string, pid: number): void {
  const pids = store.get('runningPids');
  store.set('runningPids', { ...pids, [serverId]: pid });
}

export function clearRunningPid(serverId: string): void {
  const pids = store.get('runningPids');
  const { [serverId]: _, ...rest } = pids;
  store.set('runningPids', rest);
}
