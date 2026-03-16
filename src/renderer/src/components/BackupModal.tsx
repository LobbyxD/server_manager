/**
 * World Backup modal.
 *
 * Features:
 *  - Lists all existing backups (filename, date, size).
 *  - "Create Backup" button – zips the world folder at Optimal compression.
 *  - "Restore" per backup – warns user, then extracts the zip, replacing the world.
 *  - "Delete" per backup – removes the archive file.
 *  - Shows the world name (level-name) inferred by the main process.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { BackupEntry, ServerProfile } from '../../../../shared/types';
import { useAppStore } from '../store/useAppStore';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="1" y1="1" x2="13" y2="13" />
    <line x1="13" y1="1" x2="1" y2="13" />
  </svg>
);

const IconBackup = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const IconRestore = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const IconFolder = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Confirm overlay
// ---------------------------------------------------------------------------

interface ConfirmProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const Confirm: React.FC<ConfirmProps> = ({ message, onConfirm, onCancel }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 'var(--radius)',
      zIndex: 10,
    }}
  >
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: 20,
        maxWidth: 340,
        textAlign: 'center',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 16px' }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// BackupModal
// ---------------------------------------------------------------------------

interface BackupModalProps {
  server: ServerProfile;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ server, onClose }) => {
  const serverStatuses = useAppStore((s) => s.serverStatuses);
  const status = serverStatuses[server.id] ?? 'stopped';
  const isRunning = status === 'running';

  const [backups, setBackups]       = useState<BackupEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [creating, setCreating]     = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);

  // Confirm state: { type: 'restore' | 'delete', entry: BackupEntry }
  const [confirm, setConfirm] = useState<{ type: 'restore' | 'delete'; entry: BackupEntry } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await window.api.listBackups(server.id);
      setBackups(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [server.id]);

  useEffect(() => { load(); }, [load]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const entry = await window.api.createBackup(server.id);
      showSuccess(`Backup created: ${entry.filename} (${formatSize(entry.sizeBytes)})`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (entry: BackupEntry) => {
    setConfirm(null);
    setError(null);
    setRestoringPath(entry.fullPath);
    try {
      await window.api.restoreBackup(server.id, entry.fullPath);
      showSuccess(`Restored from: ${entry.filename}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRestoringPath(null);
    }
  };

  const handleDelete = async (entry: BackupEntry) => {
    setConfirm(null);
    setError(null);
    try {
      await window.api.deleteBackup(server.id, entry.fullPath);
      showSuccess(`Deleted: ${entry.filename}`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openBackupFolder = () => {
    window.api.openFolder(server.batPath);
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 600, maxHeight: '80vh', display: 'flex', flexDirection: 'column', position: 'relative' }}
      >
        {/* Confirm overlay */}
        {confirm && (
          <Confirm
            message={
              confirm.type === 'restore'
                ? `Restore from "${confirm.entry.filename}"?\n\nThis will permanently replace your current world folder. Make sure the server is stopped.`
                : `Delete "${confirm.entry.filename}"? This cannot be undone.`
            }
            onConfirm={() =>
              confirm.type === 'restore'
                ? handleRestore(confirm.entry)
                : handleDelete(confirm.entry)
            }
            onCancel={() => setConfirm(null)}
          />
        )}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              World Backups
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              {server.name}
            </p>
          </div>
          <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }} title="Close">
            <IconClose />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            fontSize: 12, color: 'var(--danger)',
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginBottom: 10,
          }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{
            fontSize: 12, color: 'var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginBottom: 10,
          }}>
            {success}
          </div>
        )}

        {/* Running warning */}
        {isRunning && (
          <div style={{
            fontSize: 12, color: 'var(--warning, #f0a500)',
            background: 'color-mix(in srgb, #f0a500 10%, transparent)',
            border: '1px solid color-mix(in srgb, #f0a500 25%, transparent)',
            borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginBottom: 10,
          }}>
            Server is running — backups created while the server is live may capture an inconsistent world state.
            Restore is disabled while the server is running.
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={creating || loading}
            style={{ gap: 6 }}
            title="Create a new world backup now"
          >
            <IconBackup />
            {creating ? 'Creating backup…' : 'Create Backup'}
          </button>

          <button
            className="btn btn-surface"
            onClick={openBackupFolder}
            style={{ gap: 6 }}
            title="Open the World Backups folder in Explorer"
          >
            <IconFolder /> Open Folder
          </button>

          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
            {backups.length} backup{backups.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Backup list */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              Loading…
            </div>
          ) : backups.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
              No backups yet. Click "Create Backup" to make your first one.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {(['Date', 'World', 'Size', ''] as const).map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: h === '' ? 'right' : 'left',
                        padding: '4px 8px',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: 11,
                        borderBottom: '1px solid var(--border)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((entry) => {
                  // Extract world name from filename: "2026-03-16_14-30-00_world.zip" → "world"
                  const worldName = entry.filename.replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/, '').replace(/\.zip$/, '');
                  return (
                    <tr
                      key={entry.fullPath}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td style={{ padding: '7px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {formatDate(entry.createdAt)}
                      </td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>
                        {worldName}
                      </td>
                      <td style={{ padding: '7px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {formatSize(entry.sizeBytes)}
                      </td>
                      <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-surface"
                            style={{ gap: 5, fontSize: 11, padding: '3px 8px' }}
                            disabled={isRunning || restoringPath !== null}
                            title={isRunning ? 'Stop the server before restoring' : 'Replace the current world with this backup'}
                            onClick={() => setConfirm({ type: 'restore', entry })}
                          >
                            <IconRestore />
                            {restoringPath === entry.fullPath ? 'Restoring…' : 'Restore'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ gap: 5, fontSize: 11, padding: '3px 8px' }}
                            title="Delete this backup"
                            onClick={() => setConfirm({ type: 'delete', entry })}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};
