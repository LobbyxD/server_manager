/**
 * Modal dialog shown when the user tries to close the app while servers
 * are still running. Offers three choices:
 *  - Safe Exit   – sends the 'stop' command to each server, waits for shutdown, then quits.
 *  - Force Exit  – kills all server processes immediately and quits.
 *  - Cancel      – dismisses the dialog; the app keeps running.
 */

import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconWarning = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="var(--warning)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconServer = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

// ---------------------------------------------------------------------------
// QuitDialog
// ---------------------------------------------------------------------------

interface QuitDialogProps {
  /** Names of the servers that are currently running. */
  runningServers: string[];
  /** Called when the user cancels and the dialog should be unmounted. */
  onCancel: () => void;
}

export const QuitDialog: React.FC<QuitDialogProps> = ({ runningServers, onCancel }) => {
  const [stopping, setStopping] = useState(false);

  const handleSafeExit = async () => {
    setStopping(true);
    // Main process will wait for all servers to stop, then call app.quit().
    // The window will close on its own – no need to handle the Promise result.
    window.api.quitSafe();
  };

  const handleForceExit = async () => {
    setStopping(true);
    window.api.quitForce();
  };

  const handleCancel = async () => {
    if (stopping) return;
    await window.api.quitCancel();
    onCancel();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={stopping ? undefined : handleCancel}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <IconWarning />
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Servers are still running
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Choose how you'd like to exit.
            </p>
          </div>
        </div>

        {/* Server list */}
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            marginBottom: 20,
          }}
        >
          {runningServers.map((name) => (
            <div
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '3px 0',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
                <IconServer />
              </span>
              {name}
            </div>
          ))}
        </div>

        {/* Option descriptions */}
        {!stopping && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OptionHint
              label="Safe Exit"
              color="var(--accent)"
              description="Sends the 'stop' command to each server and waits for them to shut down cleanly before closing. Recommended – prevents world data loss."
            />
            <OptionHint
              label="Force Exit"
              color="var(--danger)"
              description="Terminates all server processes immediately without saving. Use only if servers are frozen and won't respond."
            />
          </div>
        )}

        {stopping && (
          <div
            style={{
              marginBottom: 20,
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              color: 'var(--accent)',
            }}
          >
            Stopping servers… the app will close automatically when done.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={handleCancel}
            disabled={stopping}
          >
            Cancel
          </button>
          <button
            className="btn btn-danger"
            onClick={handleForceExit}
            disabled={stopping}
          >
            Force Exit
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSafeExit}
            disabled={stopping}
          >
            {stopping ? 'Stopping...' : 'Safe Exit'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small helper: shows what each button does
// ---------------------------------------------------------------------------

interface OptionHintProps {
  label: string;
  color: string;
  description: string;
}

const OptionHint: React.FC<OptionHintProps> = ({ label, color, description }) => (
  <div style={{ display: 'flex', gap: 10 }}>
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        color,
        paddingTop: 1,
        minWidth: 72,
        textAlign: 'right',
      }}
    >
      {label}
    </span>
    <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
      {description}
    </span>
  </div>
);
