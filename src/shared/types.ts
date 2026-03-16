/**
 * Shared TypeScript types used across the main process, preload, and renderer.
 * Keeping types in one place ensures consistency across the IPC boundary.
 */

/** A saved server configuration profile. */
export interface ServerProfile {
  /** Unique identifier (UUID). */
  id: string;
  /** Human-readable display name chosen by the user. */
  name: string;
  /** Absolute path to the .bat or .cmd start script. */
  batPath: string;
  /** Whether to automatically start this server when the app launches. */
  autoStart: boolean;
  /** Whether to automatically create a world backup every time the server stops. */
  autoBackup: boolean;
  /** Optional path to user_jvm_args.txt for editing through the manager. */
  jvmArgsPath?: string;
}

/** Metadata about a single world backup archive. */
export interface BackupEntry {
  filename: string;
  fullPath: string;
  /** ISO-8601 timestamp of when the backup was created. */
  createdAt: string;
  /** Size of the zip archive in bytes. */
  sizeBytes: number;
}

/** Current lifecycle state of a server process. */
export type ServerStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'error';

/** A single line emitted by the server process. */
export interface LogLine {
  /** Monotonically increasing ID per server session. */
  id: number;
  /** ISO-8601 timestamp of when the line was received. */
  timestamp: string;
  /** The raw text content of the line. */
  text: string;
  /** 'out' = standard output, 'err' = standard error. */
  type: 'out' | 'err';
}

/** Persisted application settings. */
export interface AppSettings {
  /** UI color theme. */
  theme: 'dark' | 'light';
  /** Whether closing the window minimizes to the system tray instead of quitting. */
  minimizeToTray: boolean;
  /** Log viewer font size in pixels. */
  fontSize: number;
  /** Maximum number of server instances allowed to run simultaneously. */
  maxConcurrentServers: number;
  /** When true, raw technical error messages are shown instead of friendly ones. */
  debugMode: boolean;
  /** Maximum number of world backups to keep per server (oldest deleted when exceeded). */
  backupLimit: number;
  /** The ID of the last server the user had selected — restored on next launch. */
  lastServerId?: string;
  /** Whether the Player Controls panel was collapsed — restored on next launch. */
  playerPanelCollapsed?: boolean;
}

/**
 * Machine-readable error codes prefixed to IPC error messages by the main process.
 * Convention: main throws `new Error('ERROR_CODE: technical detail')`.
 * The renderer splits on the first ': ' to get the code, then maps it to a
 * friendly message when debug mode is off.
 */
export const IPC_ERROR_CODES = {
  SERVER_LIMIT: 'SERVER_LIMIT',
} as const;

/** User-facing messages shown when debug mode is OFF. */
export const USER_FRIENDLY_ERRORS: Record<string, string> = {
  SERVER_LIMIT:
    "Another server is already running. Stop it first before starting a new one, or go to Settings and increase the server limit.",
};

/** Type-safe IPC channel name constants shared by main and renderer. */
export const IPC = {
  SERVER_START: 'server:start',
  SERVER_STOP: 'server:stop',
  SERVER_RESTART: 'server:restart',
  SERVER_COMMAND: 'server:sendCommand',
  SERVER_STATUS: 'server:getStatus',
  SERVER_ALL_STATUS: 'server:allStatus',
  SERVER_FORCE_KILL: 'server:forceKill',

  LOG_LINE: 'log:line',
  SERVER_STATUS_CHANGE: 'server:statusChange',

  PROFILES_LIST: 'profiles:list',
  PROFILES_ADD: 'profiles:add',
  PROFILES_UPDATE: 'profiles:update',
  PROFILES_DELETE: 'profiles:delete',

  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  DIALOG_OPEN_BAT: 'dialog:openBat',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  BAT_READ: 'bat:read',
  BAT_WRITE: 'bat:write',
  SHELL_OPEN_FOLDER: 'shell:openFolder',
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',

  BACKUP_CREATE: 'backup:create',
  BACKUP_LIST: 'backup:list',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_DELETE: 'backup:delete',
  BACKUP_OPEN_FOLDER: 'backup:openFolder',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_MAXIMIZE_CHANGE: 'window:maximizeChange',

  /** Main→renderer push: servers are running, ask the user what to do. Payload: string[] of server names. */
  QUIT_REQUEST: 'quit:request',
  /** Renderer→main: send 'stop' to all servers, wait, then quit. */
  QUIT_SAFE: 'quit:safe',
  /** Renderer→main: force-kill all servers immediately, then quit. */
  QUIT_FORCE: 'quit:force',
  /** Renderer→main: cancel the quit – do nothing. */
  QUIT_CANCEL: 'quit:cancel',
} as const;
