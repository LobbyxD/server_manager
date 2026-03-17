/**
 * Settings modal overlay.
 * Allows the user to configure:
 *  - Dark / Light theme.
 *  - Minimize to tray on close.
 *  - Log viewer font size.
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { AppSettings } from '../../../../shared/types';

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

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}
  >
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
      )}
    </div>
    <div
      className={`toggle-track ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
      style={{ flexShrink: 0 }}
    >
      <div className="toggle-thumb" />
    </div>
  </div>
);

interface ThemeSelectorProps {
  value: 'dark' | 'light';
  onChange: (v: 'dark' | 'light') => void;
}

const ThemeSelector: React.FC<ThemeSelectorProps> = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 8 }}>
    {(['dark', 'light'] as const).map((t) => (
      <button
        key={t}
        onClick={() => onChange(t)}
        className={value === t ? 'btn btn-primary' : 'btn btn-surface'}
        style={{ flex: 1, gap: 6 }}
      >
        {t === 'dark' ? <IconMoon /> : <IconSun />}
        {t === 'dark' ? 'Dark' : 'Light'}
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const Settings: React.FC = () => {
  const settings        = useAppStore((s) => s.settings);
  const setSettings     = useAppStore((s) => s.setSettings);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const updaterStatus   = useAppStore((s) => s.updaterStatus);

  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    window.api.getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  // Local draft – only committed on Save.
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [saving, setSaving] = useState(false);

  const patch = (partial: Partial<AppSettings>) =>
    setDraft((d) => ({ ...d, ...partial }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await window.api.setSettings(draft);
      setSettings(updated);
      document.documentElement.setAttribute('data-theme', updated.theme);
      setSettingsOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => setSettingsOpen(false);

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              Settings
            </h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Minecraft Server Manager preferences
            </p>
          </div>
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ padding: 6 }}
            title="Close"
          >
            <IconClose />
          </button>
        </div>

        {/* Theme */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}
          >
            THEME
          </div>
          <ThemeSelector value={draft.theme} onChange={(t) => patch({ theme: t })} />
        </div>

        {/* Toggles */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            marginBottom: 4,
          }}
        >
          BEHAVIOUR
        </div>

        <ToggleRow
          label="Minimize to tray on close"
          description="Clicking the close button hides the window instead of quitting."
          checked={draft.minimizeToTray}
          onChange={(v) => patch({ minimizeToTray: v })}
        />

        <ToggleRow
          label="Debug mode"
          description="Show detailed technical error messages instead of plain descriptions. Turn on when troubleshooting or reporting a bug."
          checked={draft.debugMode ?? false}
          onChange={(v) => patch({ debugMode: v })}
        />

        {/* Font size */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              Log font size
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Font size used in the log viewer (px).
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ fontSize: Math.max(10, draft.fontSize - 1) })}
            >
              -
            </button>
            <span
              style={{
                width: 28,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {draft.fontSize}
            </span>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ fontSize: Math.min(20, draft.fontSize + 1) })}
            >
              +
            </button>
          </div>
        </div>

        {/* Max concurrent servers */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              Max concurrent servers
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              How many servers can run at the same time. Default is 1.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ maxConcurrentServers: Math.max(1, (draft.maxConcurrentServers ?? 1) - 1) })}
            >
              -
            </button>
            <span
              style={{
                width: 28,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {draft.maxConcurrentServers ?? 1}
            </span>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ maxConcurrentServers: Math.min(10, (draft.maxConcurrentServers ?? 1) + 1) })}
            >
              +
            </button>
          </div>
        </div>

        {/* Backup limit */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 0',
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
              Max backups per server
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Oldest backup is deleted when this limit is exceeded. Default is 5.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ backupLimit: Math.max(1, (draft.backupLimit ?? 5) - 1) })}
            >
              -
            </button>
            <span
              style={{
                width: 28,
                textAlign: 'center',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {draft.backupLimit ?? 5}
            </span>
            <button
              className="btn btn-surface"
              style={{ width: 28, height: 28, padding: 0, justifyContent: 'center' }}
              onClick={() => patch({ backupLimit: Math.min(50, (draft.backupLimit ?? 5) + 1) })}
            >
              +
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button className="btn btn-ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* Updates */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 10,
            }}
          >
            UPDATES
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            {/* Status text */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
              {updaterStatus.state === 'idle' && `Minecraft Server Manager${appVersion ? ` v${appVersion}` : ''}`}
              {updaterStatus.state === 'checking' && 'Checking for updates…'}
              {updaterStatus.state === 'not-available' && `You're on the latest version${appVersion ? ` (v${appVersion})` : ''}`}
              {updaterStatus.state === 'available' && `Update v${updaterStatus.version} is available`}
              {updaterStatus.state === 'downloading' && (
                <div>
                  <div style={{ marginBottom: 4 }}>
                    Downloading v{updaterStatus.version}… {updaterStatus.percent ?? 0}%
                  </div>
                  <div
                    style={{
                      height: 4,
                      borderRadius: 2,
                      background: 'var(--bg-elevated)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${updaterStatus.percent ?? 0}%`,
                        background: 'var(--accent)',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              )}
              {updaterStatus.state === 'ready' && `v${updaterStatus.version} ready — click Restart to install`}
              {updaterStatus.state === 'error' && `Update check failed: ${updaterStatus.error}`}
            </div>

            {/* Action button */}
            {(updaterStatus.state === 'idle' || updaterStatus.state === 'not-available' || updaterStatus.state === 'error') && (
              <button
                className="btn btn-surface"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={() => window.api.checkForUpdates()}
              >
                Check for Updates
              </button>
            )}
            {updaterStatus.state === 'available' && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={() => window.api.downloadUpdate()}
              >
                Download
              </button>
            )}
            {updaterStatus.state === 'ready' && (
              <button
                className="btn btn-primary"
                style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                onClick={() => window.api.installUpdate()}
              >
                Restart &amp; Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
