/**
 * Custom title bar for the frameless Electron window.
 * Provides:
 *  - A drag region spanning the full width.
 *  - Settings icon on the left.
 *  - Centered breadcrumb (App name / Active server name).
 *  - Creeper logo + standard window controls (Minimize, Maximize/Restore, Close)
 *    on the right.
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Icon components (inline SVG – no external dependency)
// ---------------------------------------------------------------------------

const IconSettings = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65
      1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0
      9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0
      0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65
      1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a
      1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0
      0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65
      0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const IconMinimize = () => (
  <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor">
    <rect width="10" height="1.5" y="0.25" rx="0.75" />
  </svg>
);

const IconMaximize = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.2">
    <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" />
  </svg>
);

const IconRestore = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.2">
    <rect x="2.6" y="0.6" width="6.8" height="6.8" rx="1" />
    <path d="M1 3v5.4a1 1 0 0 0 1 1h5.4" />
  </svg>
);

const IconClose = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="1" y1="1" x2="9" y2="9" />
    <line x1="9" y1="1" x2="1" y2="9" />
  </svg>
);

// ---------------------------------------------------------------------------
// Window control button
// ---------------------------------------------------------------------------

interface WinBtnProps {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}

const WinBtn: React.FC<WinBtnProps> = ({ onClick, title, danger, children }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? danger
            ? '#c42b1c'
            : 'var(--bg-elevated)'
          : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hovered && danger ? '#ffffff' : 'var(--text-secondary)',
        width: 46,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.1s, color 0.1s',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
};

// ---------------------------------------------------------------------------
// TitleBar
// ---------------------------------------------------------------------------

interface TitleBarProps {
  serverName?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ serverName }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  useEffect(() => {
    // Sync initial state.
    window.api.isMaximized().then(setIsMaximized);
    // Listen for subsequent changes.
    return window.api.onMaximizeChange(setIsMaximized);
  }, []);

  return (
    <div
      className="drag-region"
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        background: 'var(--titlebar-bg)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 100,
        paddingLeft: 4,
      }}
    >
      {/* Left: Settings button */}
      <div className="no-drag" style={{ padding: '0 4px' }}>
        <button
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          className="btn btn-ghost no-drag"
          style={{ padding: '6px 8px' }}
        >
          <IconSettings />
        </button>
      </div>

      {/* Center: Icon + Breadcrumb title */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          pointerEvents: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <img
          src="/icon.png"
          alt="App icon"
          width={18}
          height={18}
          style={{ borderRadius: 3, objectFit: 'contain', flexShrink: 0 }}
          draggable={false}
        />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {serverName ? (
            <>
              <span style={{ color: 'var(--text-muted)' }}>
                Minecraft Server Manager
              </span>
              <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>
                /
              </span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                {serverName}
              </span>
            </>
          ) : (
            'Minecraft Server Manager'
          )}
        </span>
      </div>

      {/* Right: window controls */}
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
        <WinBtn onClick={() => window.api.minimizeWindow()} title="Minimize">
          <IconMinimize />
        </WinBtn>

        <WinBtn
          onClick={() => window.api.maximizeWindow()}
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? <IconRestore /> : <IconMaximize />}
        </WinBtn>

        <WinBtn onClick={() => window.api.closeWindow()} title="Close" danger>
          <IconClose />
        </WinBtn>
      </div>
    </div>
  );
};
