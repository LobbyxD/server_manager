import type { InstallerAPI } from '../../preload/index';
export {};

declare global {
  interface Window {
    installer: InstallerAPI;
  }
}
