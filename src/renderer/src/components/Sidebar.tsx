/**
 * Left sidebar – displays the list of server profiles and an "Add Server" button.
 * Each item shows the server name, its live status indicator, and hover-revealed
 * Edit / Delete action buttons.
 */

import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServerProfile, ServerStatus } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusLabel(status: ServerStatus | undefined): string {
  switch (status) {
    case 'running':  return 'Running';
    case 'stopped':  return 'Stopped';
    case 'starting': return 'Starting...';
    case 'stopping': return 'Stopping...';
    case 'error':    return 'Error';
    default:         return 'Stopped';
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="7" y1="1" x2="7" y2="13" />
    <line x1="1" y1="7" x2="13" y2="7" />
  </svg>
);

const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Server list item
// ---------------------------------------------------------------------------

interface ServerItemProps {
  server: ServerProfile;
  isActive: boolean;
  status: ServerStatus | undefined;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ServerItem: React.FC<ServerItemProps> = ({
  server,
  isActive,
  status,
  onSelect,
  onEdit,
  onDelete,
}) => {
  const [hovered, setHovered] = useState(false);
  const effectiveStatus: ServerStatus = status ?? 'stopped';

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '9px 12px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: isActive
          ? 'var(--accent-dim)'
          : hovered
          ? 'var(--bg-hover)'
          : 'transparent',
        border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
        marginBottom: 2,
        transition: 'background 0.12s, border-color 0.12s',
        position: 'relative',
        gap: 10,
      }}
    >
      {/* Status dot */}
      <div className={`status-dot ${effectiveStatus}`} />

      {/* Name + status text */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {server.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
          {statusLabel(effectiveStatus)}
          {server.autoStart && (
            <span
              style={{
                marginLeft: 6,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                padding: '1px 5px',
                borderRadius: 3,
                fontSize: 10,
              }}
            >
              auto
            </span>
          )}
        </div>
      </div>

      {/* Action buttons – shown on hover */}
      {hovered && (
        <div
          style={{ display: 'flex', gap: 2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onEdit}
            title="Edit server"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
          >
            <IconEdit />
          </button>

          <button
            onClick={onDelete}
            title="Delete server"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--danger)';
              (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
              (e.currentTarget as HTMLElement).style.background = 'none';
            }}
          >
            <IconTrash />
          </button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export const Sidebar: React.FC = () => {
  const servers         = useAppStore((s) => s.servers);
  const activeServerId  = useAppStore((s) => s.activeServerId);
  const serverStatuses  = useAppStore((s) => s.serverStatuses);
  const setActiveServer = useAppStore((s) => s.setActiveServer);
  const removeServer    = useAppStore((s) => s.removeServer);
  const setServerFormOpen = useAppStore((s) => s.setServerFormOpen);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete server "${name}"? This cannot be undone.`)) return;
    await window.api.deleteProfile(id);
    removeServer(id);
  };

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 12px 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span className="section-label">Servers</span>
      </div>

      {/* Server list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 0' }}>
        {servers.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            No servers yet.
            <br />
            Click "Add Server" to get started.
          </div>
        ) : (
          servers.map((server) => (
            <ServerItem
              key={server.id}
              server={server}
              isActive={server.id === activeServerId}
              status={serverStatuses[server.id]}
              onSelect={() => setActiveServer(server.id)}
              onEdit={() => setServerFormOpen(true, server)}
              onDelete={() => handleDelete(server.id, server.name)}
            />
          ))
        )}
      </div>

      {/* Footer – Add Server button */}
      <div style={{ padding: 10, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => setServerFormOpen(true, null)}
          className="btn btn-surface"
          style={{ width: '100%', justifyContent: 'center', gap: 6 }}
        >
          <IconPlus />
          Add Server
        </button>
      </div>
    </aside>
  );
};
