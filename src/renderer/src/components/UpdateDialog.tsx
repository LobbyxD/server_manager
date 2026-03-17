/**
 * UpdateDialog — modal popup shown when a new version is available.
 *
 * States handled:
 *  available   → "Update Now" / "Later" buttons
 *  downloading → animated progress bar, no buttons (auto-proceeds)
 *  ready       → "Installing…" message, triggers installUpdate() automatically
 */

import React, { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Props {
  /** Called when the user clicks "Later" — hides the dialog for this session. */
  onDismiss: () => void;
}

export const UpdateDialog: React.FC<Props> = ({ onDismiss }) => {
  const updaterStatus = useAppStore((s) => s.updaterStatus);

  // When download finishes, install automatically — the app will quit.
  useEffect(() => {
    if (updaterStatus.state === 'ready') {
      window.api.installUpdate();
    }
  }, [updaterStatus.state]);

  const handleUpdateNow = () => {
    window.api.downloadUpdate();
  };

  const { state, version, percent } = updaterStatus;

  return (
    /* Full-screen overlay */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Card */}
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '28px 32px',
          width: 380,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 .49-3.29" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
              {state === 'available' && 'Update Available'}
              {state === 'downloading' && 'Downloading Update'}
              {state === 'ready' && 'Installing Update'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Minecraft Server Manager
            </div>
          </div>
        </div>

        {/* Body */}
        {state === 'available' && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Version <strong style={{ color: 'var(--text-primary)' }}>v{version}</strong> is ready
            to install. The app will restart automatically after updating.
          </p>
        )}

        {state === 'downloading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text-muted)',
              }}
            >
              <span>Downloading v{version}…</span>
              <span>{percent ?? 0}%</span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                height: 6,
                borderRadius: 3,
                background: 'var(--bg-primary)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${percent ?? 0}%`,
                  background: 'var(--accent)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {state === 'ready' && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Installing update… the app will restart in a moment.
          </p>
        )}

        {/* Buttons — only shown when waiting for user input */}
        {state === 'available' && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              className="btn btn-surface"
              style={{ fontSize: 13 }}
              onClick={onDismiss}
            >
              Later
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 13 }}
              onClick={handleUpdateNow}
            >
              Update Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
