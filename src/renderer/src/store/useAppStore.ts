/**
 * Global application state managed with Zustand.
 * All IPC-driven updates (logs, status changes) flow through this store
 * so components re-render reactively.
 */

import { create } from 'zustand';
import { ServerProfile, AppSettings, LogLine, ServerStatus } from '../../../shared/types';

/** Maximum number of log lines retained per server before oldest are dropped. */
const MAX_LOG_LINES = 2000;

interface AppState {
  // --- Data ---------------------------------------------------------------
  servers: ServerProfile[];
  activeServerId: string | null;
  serverStatuses: Record<string, ServerStatus>;
  /** Per-server log ring buffer (capped at MAX_LOG_LINES). */
  serverLogs: Record<string, LogLine[]>;
  /** Total lines ever received per server, including those trimmed from the buffer. */
  logLineCount: Record<string, number>;
  /** Online player names per server, populated after a 'list' command. */
  onlinePlayers: Record<string, string[]>;
  settings: AppSettings;

  // --- UI flags -----------------------------------------------------------
  isSettingsOpen: boolean;
  isServerFormOpen: boolean;
  /** Non-null when the form is editing an existing server (as opposed to adding). */
  editingServer: ServerProfile | null;

  // --- Actions ------------------------------------------------------------
  setServers: (servers: ServerProfile[]) => void;
  addServer: (server: ServerProfile) => void;
  updateServer: (server: ServerProfile) => void;
  removeServer: (id: string) => void;

  setActiveServer: (id: string | null) => void;
  setServerStatus: (id: string, status: ServerStatus) => void;

  appendLog: (serverId: string, line: LogLine) => void;
  clearLogs: (serverId: string) => void;
  resetLogCount: (serverId: string) => void;

  setOnlinePlayers: (serverId: string, players: string[]) => void;
  addOnlinePlayer: (serverId: string, player: string) => void;
  removeOnlinePlayer: (serverId: string, player: string) => void;

  setSettings: (settings: AppSettings) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;

  setSettingsOpen: (open: boolean) => void;
  setServerFormOpen: (open: boolean, server?: ServerProfile | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // --- Initial state ------------------------------------------------------
  servers: [],
  activeServerId: null,
  serverStatuses: {},
  serverLogs: {},
  logLineCount: {},
  onlinePlayers: {},
  settings: { theme: 'dark', minimizeToTray: true, fontSize: 13, maxConcurrentServers: 1, debugMode: false, backupLimit: 5 },
  isSettingsOpen: false,
  isServerFormOpen: false,
  editingServer: null,

  // --- Server profile actions --------------------------------------------
  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((s) => ({ servers: [...s.servers, server] })),

  updateServer: (server) =>
    set((s) => ({
      servers: s.servers.map((x) => (x.id === server.id ? server : x)),
    })),

  removeServer: (id) =>
    set((s) => ({
      servers: s.servers.filter((x) => x.id !== id),
      serverLogs: Object.fromEntries(Object.entries(s.serverLogs).filter(([k]) => k !== id)),
      logLineCount: Object.fromEntries(Object.entries(s.logLineCount).filter(([k]) => k !== id)),
      onlinePlayers: Object.fromEntries(Object.entries(s.onlinePlayers).filter(([k]) => k !== id)),
      serverStatuses: Object.fromEntries(Object.entries(s.serverStatuses).filter(([k]) => k !== id)),
      activeServerId: s.activeServerId === id ? null : s.activeServerId,
    })),

  // --- Server state actions -----------------------------------------------
  setActiveServer: (id) => set({ activeServerId: id }),

  setServerStatus: (id, status) =>
    set((s) => ({
      serverStatuses: { ...s.serverStatuses, [id]: status },
    })),

  // --- Log actions --------------------------------------------------------
  appendLog: (serverId, line) =>
    set((s) => {
      const existing = s.serverLogs[serverId] ?? [];
      const appended = [...existing, line];
      const trimmed =
        appended.length > MAX_LOG_LINES
          ? appended.slice(appended.length - MAX_LOG_LINES)
          : appended;
      return {
        serverLogs: { ...s.serverLogs, [serverId]: trimmed },
        logLineCount: { ...s.logLineCount, [serverId]: (s.logLineCount[serverId] ?? 0) + 1 },
      };
    }),

  clearLogs: (serverId) =>
    set((s) => ({
      serverLogs: { ...s.serverLogs, [serverId]: [] },
      logLineCount: { ...s.logLineCount, [serverId]: 0 },
    })),

  resetLogCount: (serverId) =>
    set((s) => ({ logLineCount: { ...s.logLineCount, [serverId]: 0 } })),

  // --- Players ------------------------------------------------------------
  setOnlinePlayers: (serverId, players) =>
    set((s) => ({
      onlinePlayers: { ...s.onlinePlayers, [serverId]: players },
    })),

  addOnlinePlayer: (serverId, player) =>
    set((s) => {
      const existing = s.onlinePlayers[serverId] ?? [];
      if (existing.includes(player)) return s;
      return { onlinePlayers: { ...s.onlinePlayers, [serverId]: [...existing, player] } };
    }),

  removeOnlinePlayer: (serverId, player) =>
    set((s) => {
      const existing = s.onlinePlayers[serverId] ?? [];
      return { onlinePlayers: { ...s.onlinePlayers, [serverId]: existing.filter((p) => p !== player) } };
    }),

  // --- Settings actions ---------------------------------------------------
  setSettings: (settings) => set({ settings }),

  patchSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch } })),

  // --- UI actions ---------------------------------------------------------
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setServerFormOpen: (open, server = null) =>
    set({ isServerFormOpen: open, editingServer: server ?? null }),
}));
