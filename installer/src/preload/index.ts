import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type ProgressPayload = {
  phase: 'copying' | 'registry' | 'shortcuts' | 'cleanup' | 'done' | 'error';
  percent: number;
  message: string;
  error?: string;
};

export type DetectResult = {
  installed: boolean;
  installPath?: string;
  installedVersion?: string;
};

export type InstallOptions = {
  installPath: string;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
};

const api = {
  detect:       (): Promise<DetectResult>      => ipcRenderer.invoke('installer:detect'),
  browse:       (): Promise<string | null>     => ipcRenderer.invoke('installer:browse'),
  getVersion:      (): Promise<string>            => ipcRenderer.invoke('installer:getVersion'),
  getDefaultPath:  (): Promise<string>            => ipcRenderer.invoke('installer:getDefaultPath'),
  install:      (opts: InstallOptions): Promise<void> => ipcRenderer.invoke('installer:install', opts),
  repair:       (): Promise<void>              => ipcRenderer.invoke('installer:repair'),
  uninstall:    (opts: { removeData: boolean }): Promise<void> => ipcRenderer.invoke('installer:uninstall', opts),
  openFolder:   (p: string): Promise<void>    => ipcRenderer.invoke('installer:openFolder', p),
  close:        () => ipcRenderer.send('installer:close'),

  onProgress: (cb: (p: ProgressPayload) => void): (() => void) => {
    const handler = (_e: IpcRendererEvent, p: ProgressPayload) => cb(p);
    ipcRenderer.on('installer:progress', handler);
    return () => ipcRenderer.removeListener('installer:progress', handler);
  },
};

contextBridge.exposeInMainWorld('installer', api);
export type InstallerAPI = typeof api;
