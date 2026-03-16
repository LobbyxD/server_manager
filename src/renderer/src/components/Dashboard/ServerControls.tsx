/**
 * Top control bar for the active server.
 * Provides: Start, Stop, Restart buttons + an Auto-start toggle.
 * Button states are disabled/enabled based on the server's live status.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { ServerStatus } from '../../../../shared/types';
import { ServerSettingsModal } from '../ServerSettingsModal';

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

const IconSettings = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
// ServerControls
// ---------------------------------------------------------------------------

export const ServerControls: React.FC = () => {
  const activeServerId  = useAppStore((s) => s.activeServerId);
  const serverStatuses  = useAppStore((s) => s.serverStatuses);
  const servers         = useAppStore((s) => s.servers);
  const setServerStatus = useAppStore((s) => s.setServerStatus);
  const clearLogs       = useAppStore((s) => s.clearLogs);
  const debugMode       = useAppStore((s) => s.settings.debugMode ?? false);

  const [loading, setLoading]           = useState<string | null>(null);
  const [startError, setStartError]     = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Tracks whether a "restart" is pending after server stops.
  const pendingRestartRef = useRef(false);

  const server = servers.find((s) => s.id === activeServerId) ?? null;
  const status: ServerStatus = (activeServerId && serverStatuses[activeServerId]) ?? 'stopped';

  const isRunning  = status === 'running';
  const isStopped  = status === 'stopped' || status === 'error';
  const isBusy     = loading !== null;

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(action);
    try { await fn(); } finally { setLoading(null); }
  };

  // When activeServerId changes, cancel any pending restart for the old server.
  useEffect(() => {
    if (pendingRestartRef.current) {
      pendingRestartRef.current = false;
      setLoading(null);
    }
  }, [activeServerId]);

  // After server stops: if a restart was pending, clear logs then start fresh.
  useEffect(() => {
    if (!pendingRestartRef.current || status !== 'stopped' || !activeServerId) return;
    pendingRestartRef.current = false;
    const sid = activeServerId;
    clearLogs(sid);
    setServerStatus(sid, 'starting');
    setLoading(null);
    window.api.startServer(sid).catch((e) => {
      setServerStatus(sid, 'stopped');
      setStartError(resolveError(e, debugMode));
    });
  }, [status, activeServerId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleRestart = () => {
    if (!activeServerId || !isRunning) return;
    setStartError(null);
    setLoading('restart');
    setServerStatus(activeServerId, 'stopping');
    pendingRestartRef.current = true;
    window.api.stopServer(activeServerId).catch(() => {
      pendingRestartRef.current = false;
      setLoading(null);
    });
  };

  const handleForceKill = () =>
    run('forceKill', async () => {
      setServerStatus(activeServerId!, 'stopping');
      await window.api.forceKillServer(activeServerId!);
    });

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

      {/* Force Stop */}
      <button
        className="btn btn-danger"
        onClick={handleForceKill}
        disabled={isBusy || status === 'stopped'}
        title="Immediately terminate this server's process (cmd.exe + java.exe). Use this if Stop is unresponsive or the server is an orphan from a previous session."
      >
        {loading === 'forceKill' ? (
          <span style={{ opacity: 0.7 }}>Stopping...</span>
        ) : (
          <><IconForceKill /> Force Stop</>
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

      {/* Server Settings (tabbed modal for all config files) */}
      <button
        className="btn btn-surface"
        onClick={() => setSettingsOpen(true)}
        title="Edit server.properties, eula.txt, run script, and JVM args"
        style={{ gap: 5 }}
      >
        <IconSettings /> Server Settings
      </button>

      {settingsOpen && (
        <ServerSettingsModal server={server} onClose={() => setSettingsOpen(false)} />
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
