import React, { useState, useEffect } from 'react';
import type { ProgressPayload } from '../../../preload/index';
import { ProgressBar } from './ProgressBar';

const DEFAULT_PATH = 'C:\\Minecraft Server Manager';

interface Props {
  bundledVersion: string;
}

export const InstallView: React.FC<Props> = ({ bundledVersion }) => {
  const [installPath,       setInstallPath]       = useState(DEFAULT_PATH);
  const [desktopShortcut,   setDesktopShortcut]   = useState(true);
  const [startMenuShortcut, setStartMenuShortcut] = useState(true);
  const [installing,        setInstalling]        = useState(false);
  const [progress,          setProgress]          = useState<ProgressPayload | null>(null);

  useEffect(() => {
    const unsub = window.installer.onProgress((p) => setProgress(p));
    return unsub;
  }, []);

  const handleBrowse = async () => {
    const chosen = await window.installer.browse();
    if (chosen) setInstallPath(chosen);
  };

  const handleInstall = () => {
    setInstalling(true);
    setProgress(null);
    window.installer.install({ installPath, desktopShortcut, startMenuShortcut });
  };

  const handleFinish = () => window.installer.close();

  const done = progress?.phase === 'done';

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
        Install Minecraft Server Manager
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
        Version {bundledVersion} — choose your options below
      </div>

      {/* Directory picker */}
      <Label>Installation folder</Label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={installPath}
          onChange={(e) => setInstallPath(e.target.value)}
          disabled={installing}
          style={inputStyle}
        />
        <button onClick={handleBrowse} disabled={installing} style={btnStyle('secondary')}>
          Browse
        </button>
      </div>

      {/* Shortcuts */}
      <Label>Shortcuts</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        <Checkbox
          checked={desktopShortcut}
          onChange={setDesktopShortcut}
          disabled={installing}
          label="Create Desktop shortcut"
        />
        <Checkbox
          checked={startMenuShortcut}
          onChange={setStartMenuShortcut}
          disabled={installing}
          label="Create Start Menu shortcut"
        />
      </div>

      {/* Install button */}
      {!installing && (
        <button onClick={handleInstall} style={btnStyle('primary')}>
          Install
        </button>
      )}

      {/* Progress */}
      {installing && (
        <ProgressBar
          progress={progress}
          installPath={done ? installPath : undefined}
          onDone={handleFinish}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
    {children}
  </div>
);

const Checkbox: React.FC<{ checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string }> = ({
  checked, onChange, disabled, label,
}) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 13, color: disabled ? 'rgba(255,255,255,0.3)' : '#ddd' }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      style={{ width: 15, height: 15, accentColor: '#4f8ef7', cursor: 'inherit' }}
    />
    {label}
  </label>
);

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  padding: '7px 10px',
  color: '#fff',
  fontSize: 13,
  outline: 'none',
};

function btnStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  return {
    padding: '7px 16px',
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: variant === 'primary' ? '#4f8ef7' : 'rgba(255,255,255,0.08)',
    color: '#fff',
    whiteSpace: 'nowrap',
  };
}
