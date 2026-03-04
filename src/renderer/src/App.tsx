/**
 * Root React component.
 * - Loads initial data from the main process on mount.
 * - Applies the active theme to <html>.
 * - Renders the three-zone layout: TitleBar / Sidebar / Dashboard.
 * - Mounts modal overlays for Settings and ServerForm.
 */

import React, { useEffect, useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';
import { ServerForm } from './components/ServerForm';
import { QuitDialog } from './components/QuitDialog';
import { useAppStore } from './store/useAppStore';
import { useServerEvents } from './hooks/useServerEvents';

export const App: React.FC = () => {
  const servers        = useAppStore((s) => s.servers);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const settings       = useAppStore((s) => s.settings);
  const setServers     = useAppStore((s) => s.setServers);
  const setSettings    = useAppStore((s) => s.setSettings);
  const isSettingsOpen    = useAppStore((s) => s.isSettingsOpen);
  const isServerFormOpen  = useAppStore((s) => s.isServerFormOpen);
  const setServerStatus   = useAppStore((s) => s.setServerStatus);

  /** Non-null when the quit dialog is open; holds the list of running server names. */
  const [quitServers, setQuitServers] = useState<string[] | null>(null);

  // Wire up IPC push events into the store.
  useServerEvents();

  // Listen for the main process asking what to do when servers are still running.
  useEffect(() => {
    const unsub = window.api.onQuitRequest((names) => setQuitServers(names));
    return unsub;
  }, []);

  // Apply theme class to <html> whenever it changes.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Load persisted data on first mount.
  useEffect(() => {
    const init = async () => {
      const [profiles, appSettings, allStatuses] = await Promise.all([
        window.api.listProfiles(),
        window.api.getSettings(),
        window.api.getAllStatuses(),
      ]);

      setServers(profiles);
      setSettings(appSettings);
      document.documentElement.setAttribute('data-theme', appSettings.theme);

      // Hydrate server statuses (e.g. after auto-start on launch).
      for (const [id, status] of Object.entries(allStatuses)) {
        setServerStatus(id, status as import('../../../shared/types').ServerStatus);
      }
    };

    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeServer = servers.find((s) => s.id === activeServerId) ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      <TitleBar serverName={activeServer?.name} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <Dashboard />
      </div>

      {isSettingsOpen  && <Settings />}
      {isServerFormOpen && <ServerForm />}
      {quitServers && (
        <QuitDialog
          runningServers={quitServers}
          onCancel={() => setQuitServers(null)}
        />
      )}
    </div>
  );
};
