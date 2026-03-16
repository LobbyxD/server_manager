/**
 * Global window.api type declaration.
 * Mirrors the object exposed by src/preload/index.ts via contextBridge.
 */

import { LogLine, ServerProfile, AppSettings, BackupEntry } from '../../shared/types';

declare global {
  interface Window {
    api: {
      // Server lifecycle
      startServer: (id: string) => Promise<{ success: boolean }>;
      stopServer: (id: string) => Promise<{ success: boolean }>;
      restartServer: (id: string) => Promise<{ success: boolean }>;
      sendCommand: (id: string, cmd: string) => Promise<{ success: boolean }>;
      getServerStatus: (id: string) => Promise<string>;
      getAllStatuses: () => Promise<Record<string, string>>;
      forceKillServer: (id: string) => Promise<{ success: boolean }>;

      // Profiles
      listProfiles: () => Promise<ServerProfile[]>;
      addProfile: (profile: Omit<ServerProfile, 'id'>) => Promise<ServerProfile>;
      updateProfile: (profile: ServerProfile) => Promise<ServerProfile>;
      deleteProfile: (id: string) => Promise<{ success: boolean }>;

      // Settings
      getSettings: () => Promise<AppSettings>;
      setSettings: (patch: Partial<AppSettings>) => Promise<AppSettings>;

      // File dialog
      browseBatFile: () => Promise<string | null>;
      browseFile: (title?: string) => Promise<string | null>;

      // Shell operations
      openFolder: (filePath: string) => Promise<{ success: boolean }>;
      openExternal: (url: string) => Promise<{ success: boolean }>;

      // World backups
      listBackups: (id: string) => Promise<BackupEntry[]>;
      createBackup: (id: string) => Promise<BackupEntry>;
      restoreBackup: (id: string, backupFilePath: string) => Promise<{ success: boolean }>;
      deleteBackup: (id: string, backupFilePath: string) => Promise<{ success: boolean }>;
      openBackupFolder: (id: string) => Promise<{ success: boolean }>;

      // BAT file editor
      readBatFile: (filePath: string) => Promise<string>;
      writeBatFile: (filePath: string, content: string) => Promise<{ success: boolean }>;

      // Window controls
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      isMaximized: () => Promise<boolean>;

      // Push event subscriptions
      onLog: (callback: (serverId: string, line: LogLine) => void) => () => void;
      onStatusChange: (callback: (serverId: string, status: string) => void) => () => void;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => () => void;
      onQuitRequest: (callback: (runningServers: string[]) => void) => () => void;

      // Quit confirmation
      quitSafe: () => Promise<void>;
      quitForce: () => Promise<void>;
      quitCancel: () => Promise<void>;
    };
  }
}
