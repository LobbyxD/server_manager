/**
 * Top control bar for the active server.
 * Provides: Start, Stop, Restart buttons + an Auto-start toggle.
 * Button states are disabled/enabled based on the server's live status.
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ServerStatus } from '../../../../shared/types';
import { BatEditor } from '../BatEditor';

/**
 * Maps a thrown IPC error to a display message.
 * Electron wraps thrown errors as: "Error invoking remote method 'channel': Error: CODE: detail"
 * so we search for known codes anywhere in the string instead of at the start.
 */
function resolveError(e: unknown, debugMode: boolean): string {
  const raw = (e as Error).message ?? String(e);
  if (debugMode) return raw;

  if (raw.includes('SERVER_LIMIT')) {
    // Extract the limit number from the technical detail, e.g. "(1/1 running)"
    const match = raw.match(/(\d+)\/(\d+) running/);
    const limit = match ? Number(match[2]) : null;
    return limit !== null
      ? `You've reached the server limit (${limit}). Go to Settings → "Max concurrent servers" to run more at once.`
      : "You've reached the server limit. Go to Settings to increase it.";
  }

  return "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconPlay = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);

const IconStop = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const IconForceKill = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconRestart = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

// ---------------------------------------------------------------------------
// Auto-start Toggle
// ---------------------------------------------------------------------------

interface AutoStartToggleProps {
  enabled: boolean;
  onChange: (val: boolean) => void;
}

const AutoStartToggle: React.FC<AutoStartToggleProps> = ({ enabled, onChange }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '4px 10px',
      background: 'var(--bg-elevated)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--border)',
      cursor: 'pointer',
    }}
    onClick={() => onChange(!enabled)}
    title="Toggle auto-start on app launch"
  >
    <div className={`toggle-track ${enabled ? 'on' : ''}`}>
      <div className="toggle-thumb" />
    </div>
    <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
      Auto-start
    </span>
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: enabled ? 'var(--accent)' : 'var(--text-muted)',
      }}
    >
      {enabled ? 'ON' : 'OFF'}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// ServerControls
// ---------------------------------------------------------------------------

export const ServerControls: React.FC = () => {
  const activeServerId  = useAppStore((s) => s.activeServerId);
  const serverStatuses  = useAppStore((s) => s.serverStatuses);
  const servers         = useAppStore((s) => s.servers);
  const updateServer    = useAppStore((s) => s.updateServer);
  const setServerStatus = useAppStore((s) => s.setServerStatus);
  const clearLogs       = useAppStore((s) => s.clearLogs);
  const debugMode       = useAppStore((s) => s.settings.debugMode ?? false);

  const [loading, setLoading]             = useState<string | null>(null);
  const [startError, setStartError]       = useState<string | null>(null);
  const [batEditorOpen, setBatEditorOpen] = useState(false);

  const server = servers.find((s) => s.id === activeServerId) ?? null;
  const status: ServerStatus = (activeServerId && serverStatuses[activeServerId]) ?? 'stopped';

  const isRunning  = status === 'running';
  const isStopped  = status === 'stopped' || status === 'error';
  const isBusy     = loading !== null;

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action);
    try { await fn(); } finally { setLoading(null); }
  };

  const handleStart = async () => {
    if (!activeServerId) return;
    setStartError(null);
    clearLogs(activeServerId);
    setLoading('start');
    setServerStatus(activeServerId, 'starting');
    try {
      await window.api.startServer(activeServerId);
    } catch (e) {
      setServerStatus(activeServerId, 'stopped');
      setStartError(resolveError(e, debugMode));
    } finally {
      setLoading(null);
    }
  };

  const handleStop = () =>
    run('stop', async () => {
      setServerStatus(activeServerId!, 'stopping');
      await window.api.stopServer(activeServerId!);
    });

  const handleRestart = () =>
    run('restart', async () => {
      setServerStatus(activeServerId!, 'stopping');
      await window.api.restartServer(activeServerId!);
    });

  const handleForceKill = () =>
    run('forceKill', async () => {
      setServerStatus(activeServerId!, 'stopping');
      await window.api.forceKillServer(activeServerId!);
    });

  const handleAutoStartChange = async (val: boolean) => {
    if (!server) return;
    const updated = { ...server, autoStart: val };
    await window.api.updateProfile(updated);
    updateServer(updated);
  };

  if (!server) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}
    >
      {/* Start */}
      <button
        className="btn btn-primary"
        onClick={handleStart}
        disabled={!isStopped || isBusy}
        title="Start the server"
      >
        {loading === 'start' ? (
          <span style={{ opacity: 0.7 }}>Starting...</span>
        ) : (
          <><IconPlay /> Start</>
        )}
      </button>

      {/* Stop */}
      <button
        className="btn btn-danger"
        onClick={handleStop}
        disabled={!isRunning || isBusy}
        title="Stop the server gracefully (sends 'stop' command)"
      >
        {loading === 'stop' ? (
          <span style={{ opacity: 0.7 }}>Stopping...</span>
        ) : (
          <><IconStop /> Stop</>
        )}
      </button>

      {/* Restart */}
      <button
        className="btn btn-surface"
        onClick={handleRestart}
        disabled={!isRunning || isBusy}
        title="Stop then immediately restart the server"
      >
        {loading === 'restart' ? (
          <span style={{ opacity: 0.7 }}>Restarting...</span>
        ) : (
          <><IconRestart /> Restart</>
        )}
      </button>

      {/* Force Kill */}
      <button
        className="btn btn-danger"
        onClick={handleForceKill}
        disabled={isBusy}
        title="Immediately kill the server process tree (cmd.exe + java.exe). Use this if Stop is unresponsive or the process is an orphan from a previous session."
        style={{ opacity: 0.85 }}
      >
        {loading === 'forceKill' ? (
          <span style={{ opacity: 0.7 }}>Killing...</span>
        ) : (
          <><IconForceKill /> Force Kill</>
        )}
      </button>

      {/* Divider */}
      <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className={`status-dot ${status}`} />
        <span
          style={{
            fontSize: 12,
            color: status === 'running'
              ? 'var(--accent)'
              : status === 'error'
              ? 'var(--danger)'
              : 'var(--text-muted)',
          }}
        >
          {status === 'running'  ? 'Running'
           : status === 'stopped' ? 'Stopped'
           : status === 'starting' ? 'Starting...'
           : status === 'stopping' ? 'Stopping...'
           : 'Error'}
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Edit .bat script */}
      <button
        className="btn btn-surface"
        onClick={() => setBatEditorOpen(true)}
        title="Edit the server start script (.bat)"
        style={{ gap: 5 }}
      >
        <IconEdit /> Edit Script
      </button>

      {/* Auto-start toggle */}
      <AutoStartToggle
        enabled={server.autoStart}
        onChange={handleAutoStartChange}
      />

      {batEditorOpen && (
        <BatEditor batPath={server.batPath} onClose={() => setBatEditorOpen(false)} />
      )}

      {/* Start error banner */}
      {startError && (
        <div
          style={{
            flexBasis: '100%',
            fontSize: 11,
            color: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            borderRadius: 'var(--radius-sm)',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
          }}
        >
          {debugMode && (
            <span
              style={{
                flexShrink: 0,
                fontWeight: 700,
                opacity: 0.7,
                fontFamily: 'monospace',
              }}
            >
              [DEBUG]
            </span>
          )}
          {startError}
        </div>
      )}
    </div>
  );
};
