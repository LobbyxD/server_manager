/**
 * Preload script – runs in a Node.js context with access to Electron APIs,
 * but inside the renderer's web page. contextBridge.exposeInMainWorld()
 * safely forwards a subset of Electron/Node functionality to the renderer
 * under window.api without granting unrestricted Node access.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC, LogLine, ServerProfile, AppSettings, BackupEntry } from '../shared/types';

// ---------------------------------------------------------------------------
// Type-safe wrapper functions
// ---------------------------------------------------------------------------

const api = {
  // --- Server lifecycle ---------------------------------------------------
  startServer: (id: string) => ipcRenderer.invoke(IPC.SERVER_START, id),
  stopServer: (id: string) => ipcRenderer.invoke(IPC.SERVER_STOP, id),
  restartServer: (id: string) => ipcRenderer.invoke(IPC.SERVER_RESTART, id),
  sendCommand: (id: string, cmd: string) =>
    ipcRenderer.invoke(IPC.SERVER_COMMAND, id, cmd),
  getServerStatus: (id: string) => ipcRenderer.invoke(IPC.SERVER_STATUS, id),
  getAllStatuses: (): Promise<Record<string, string>> =>
    ipcRenderer.invoke(IPC.SERVER_ALL_STATUS),
  forceKillServer: (id: string) => ipcRenderer.invoke(IPC.SERVER_FORCE_KILL, id),

  // --- Profiles -----------------------------------------------------------
  listProfiles: (): Promise<ServerProfile[]> =>
    ipcRenderer.invoke(IPC.PROFILES_LIST),
  addProfile: (profile: Omit<ServerProfile, 'id'>): Promise<ServerProfile> =>
    ipcRenderer.invoke(IPC.PROFILES_ADD, profile),
  updateProfile: (profile: ServerProfile): Promise<ServerProfile> =>
    ipcRenderer.invoke(IPC.PROFILES_UPDATE, profile),
  deleteProfile: (id: string) => ipcRenderer.invoke(IPC.PROFILES_DELETE, id),

  // --- Settings -----------------------------------------------------------
  getSettings: (): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_GET),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.SETTINGS_SET, patch),

  // --- File dialog --------------------------------------------------------
  browseBatFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_BAT),
  browseFile: (title?: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE, title),

  // --- BAT file editor ----------------------------------------------------
  readBatFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.BAT_READ, filePath),
  writeBatFile: (filePath: string, content: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.BAT_WRITE, filePath, content),

  // --- Shell operations ---------------------------------------------------
  openFolder: (filePath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.SHELL_OPEN_FOLDER, filePath),
  openExternal: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url),

  // --- World backups -------------------------------------------------------
  listBackups: (id: string): Promise<BackupEntry[]> =>
    ipcRenderer.invoke(IPC.BACKUP_LIST, id),
  createBackup: (id: string): Promise<BackupEntry> =>
    ipcRenderer.invoke(IPC.BACKUP_CREATE, id),
  restoreBackup: (id: string, backupFilePath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.BACKUP_RESTORE, id, backupFilePath),
  deleteBackup: (id: string, backupFilePath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.BACKUP_DELETE, id, backupFilePath),
  openBackupFolder: (id: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC.BACKUP_OPEN_FOLDER, id),

  // --- Window controls (fire-and-forget) ----------------------------------
  minimizeWindow: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
  maximizeWindow: () => ipcRenderer.send(IPC.WINDOW_MAXIMIZE),
  closeWindow: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  isMaximized: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC.WINDOW_IS_MAXIMIZED),

  // --- Push event subscriptions -------------------------------------------
  /** Subscribe to log lines. Returns an unsubscribe function. */
  onLog: (
    callback: (serverId: string, line: LogLine) => void,
  ): (() => void) => {
    const handler = (
      _event: IpcRendererEvent,
      serverId: string,
      line: LogLine,
    ) => callback(serverId, line);
    ipcRenderer.on(IPC.LOG_LINE, handler);
    return () => ipcRenderer.removeListener(IPC.LOG_LINE, handler);
  },

  /** Subscribe to server status changes. Returns an unsubscribe function. */
  onStatusChange: (
    callback: (serverId: string, status: string) => void,
  ): (() => void) => {
    const handler = (
      _event: IpcRendererEvent,
      serverId: string,
      status: string,
    ) => callback(serverId, status);
    ipcRenderer.on(IPC.SERVER_STATUS_CHANGE, handler);
    return () =>
      ipcRenderer.removeListener(IPC.SERVER_STATUS_CHANGE, handler);
  },

  /** Subscribe to maximize/restore state changes. Returns an unsubscribe function. */
  onMaximizeChange: (
    callback: (isMaximized: boolean) => void,
  ): (() => void) => {
    const handler = (
      _event: IpcRendererEvent,
      isMaximized: boolean,
    ) => callback(isMaximized);
    ipcRenderer.on(IPC.WINDOW_MAXIMIZE_CHANGE, handler);
    return () =>
      ipcRenderer.removeListener(IPC.WINDOW_MAXIMIZE_CHANGE, handler);
  },

  /**
   * Subscribe to quit requests from the main process.
   * Fired when the user tries to close the app while servers are still running.
   * Payload: array of running server display names.
   */
  onQuitRequest: (
    callback: (runningServers: string[]) => void,
  ): (() => void) => {
    const handler = (
      _event: IpcRendererEvent,
      names: string[],
    ) => callback(names);
    ipcRenderer.on(IPC.QUIT_REQUEST, handler);
    return () => ipcRenderer.removeListener(IPC.QUIT_REQUEST, handler);
  },

  /** Gracefully stop all servers then quit the app. */
  quitSafe: (): Promise<void> => ipcRenderer.invoke(IPC.QUIT_SAFE),
  /** Force-kill all servers immediately then quit the app. */
  quitForce: (): Promise<void> => ipcRenderer.invoke(IPC.QUIT_FORCE),
  /** Cancel the pending quit – the app stays open. */
  quitCancel: (): Promise<void> => ipcRenderer.invoke(IPC.QUIT_CANCEL),
};

contextBridge.exposeInMainWorld('api', api);

// Export type for the renderer's global Window augmentation.
export type ElectronAPI = typeof api;
