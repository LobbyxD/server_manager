import type { InstallerAPI } from '../../preload/index';

declare global {
  interface Window {
    installer: InstallerAPI;
  }
}
