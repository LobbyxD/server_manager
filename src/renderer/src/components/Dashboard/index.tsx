/**
 * Main dashboard area – shown when a server is selected.
 * Layout (top to bottom):
 *   ServerControls bar
 *   ┌─────────────────────┬──────────────┐
 *   │  LogViewer (flex 1) │  PlayerPanel │
 *   └─────────────────────┴──────────────┘
 *
 * When no server is selected, a centred empty-state prompt is shown.
 */

import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ServerControls } from './ServerControls';
import { LogViewer } from './LogViewer';
import { PlayerPanel } from './PlayerPanel';

const EmptyState: React.FC = () => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      color: 'var(--text-muted)',
      userSelect: 'none',
    }}
  >
    {/* Large faded creeper icon */}
    <svg
      width="64"
      height="64"
      viewBox="0 0 22 22"
      style={{ opacity: 0.12 }}
    >
      <rect x="2" y="1" width="18" height="20" rx="2" fill="var(--text-primary)" />
      <rect x="5"  y="6" width="4" height="4" rx="1" fill="var(--bg-primary)" />
      <rect x="13" y="6" width="4" height="4" rx="1" fill="var(--bg-primary)" />
      <rect x="9"  y="12" width="4" height="2" fill="var(--bg-primary)" />
      <rect x="7"  y="14" width="8" height="2" fill="var(--bg-primary)" />
      <rect x="9"  y="16" width="4" height="2" fill="var(--bg-primary)" />
    </svg>

    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
      No server selected
    </div>
    <div style={{ fontSize: 12 }}>
      Choose a server from the sidebar, or add one with "Add Server".
    </div>
  </div>
);

export const Dashboard: React.FC = () => {
  const activeServerId = useAppStore((s) => s.activeServerId);

  if (!activeServerId) {
    return (
      <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <EmptyState />
      </main>
    );
  }

  return (
    <main
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Server control bar */}
      <ServerControls />

      {/* Log + Player panel row */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LogViewer />
        <PlayerPanel />
      </div>
    </main>
  );
};
