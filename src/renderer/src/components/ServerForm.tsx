/**
 * Modal dialog for adding a new server profile or editing an existing one.
 * Fields: display name, path to the .bat file (with a Browse button),
 * and an auto-start toggle.
 */

import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ServerProfile } from '../../../../shared/types';

// ---------------------------------------------------------------------------
// Toggle component (reusable within this module)
// ---------------------------------------------------------------------------

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div
      className={`toggle-track ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <div className="toggle-thumb" />
    </div>
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {description}
        </div>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export const ServerForm: React.FC = () => {
  const editingServer    = useAppStore((s) => s.editingServer);
  const addServer        = useAppStore((s) => s.addServer);
  const updateServer     = useAppStore((s) => s.updateServer);
  const setServerFormOpen = useAppStore((s) => s.setServerFormOpen);

  const isEditing = editingServer !== null;

  const [name, setName]         = useState('');
  const [batPath, setBatPath]   = useState('');
  const [autoStart, setAutoStart] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  // Populate fields when editing an existing server.
  useEffect(() => {
    if (editingServer) {
      setName(editingServer.name);
      setBatPath(editingServer.batPath);
      setAutoStart(editingServer.autoStart);
    }
  }, [editingServer]);

  const handleBrowse = async () => {
    const path = await window.api.browseBatFile();
    if (!path) return;
    setBatPath(path);
    // Auto-fill a sensible name from the parent folder if name is still blank.
    if (!name.trim()) {
      const parts = path.replace(/\\/g, '/').split('/');
      setName(parts[parts.length - 2] ?? parts[parts.length - 1] ?? '');
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedPath = batPath.trim();

    if (!trimmedName) { setError('Server name is required.'); return; }
    if (!trimmedPath)  { setError('Please select a .bat start script.'); return; }

    setError('');
    setSaving(true);

    try {
      if (isEditing && editingServer) {
        const updated: ServerProfile = {
          ...editingServer,
          name: trimmedName,
          batPath: trimmedPath,
          autoStart,
        };
        const saved = await window.api.updateProfile(updated);
        updateServer(saved);
      } else {
        const saved = await window.api.addProfile({
          name: trimmedName,
          batPath: trimmedPath,
          autoStart,
        });
        addServer(saved);
      }
      setServerFormOpen(false);
    } catch (err) {
      setError((err as Error).message ?? 'Failed to save server.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => setServerFormOpen(false);

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {isEditing ? 'Edit Server' : 'Add Server'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            {isEditing
              ? 'Update the server profile settings.'
              : 'Point to your server\'s start .bat file.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--danger)',
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 5,
                fontWeight: 500,
              }}
            >
              Display Name
            </label>
            <input
              className="field"
              type="text"
              placeholder="e.g. Survival SMP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Bat path */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 5,
                fontWeight: 500,
              }}
            >
              Start Script (.bat / .cmd)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="field"
                type="text"
                placeholder="C:\Servers\MySMP\start.bat"
                value={batPath}
                onChange={(e) => setBatPath(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-surface"
                onClick={handleBrowse}
                style={{ flexShrink: 0 }}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Auto-start toggle */}
          <Toggle
            checked={autoStart}
            onChange={setAutoStart}
            label="Auto-start on launch"
            description="Start this server automatically when the app opens."
          />
        </div>

        {/* Footer buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 24,
          }}
        >
          <button className="btn btn-ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  );
};
