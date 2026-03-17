import React, { useState, useEffect } from 'react';
import type { ProgressPayload } from '../../../preload/index';
import { ProgressBar } from './ProgressBar';

interface Props {
  bundledVersion: string;
}

export const InstallView: React.FC<Props> = ({ bundledVersion }) => {
  const [installPath,       setInstallPath]       = useState('');
  const [desktopShortcut,   setDesktopShortcut]   = useState(true);
  const [startMenuShortcut, setStartMenuShortcut] = useState(true);
  const [installing,        setInstalling]        = useState(false);
  const [progress,          setProgress]          = useState<ProgressPayload | null>(null);

  useEffect(() => {
    window.installer.getDefaultPath().then(setInstallPath);
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

  const done = progress?.phase === 'done';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Title */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Install Minecraft Server Manager
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Version {bundledVersion} — choose your options below
        </div>
      </div>

      {/* Install path */}
      <div className="panel">
        <span className="section-label">Installation Folder</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="field"
            value={installPath}
            onChange={(e) => setInstallPath(e.target.value)}
            disabled={installing}
          />
          <button className="btn btn-surface" onClick={handleBrowse} disabled={installing}>
            Browse
          </button>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="panel">
        <span className="section-label">Shortcuts</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
      </div>

      {/* Install button */}
      {!installing && (
        <button className="btn btn-primary" onClick={handleInstall} style={{ alignSelf: 'flex-start', padding: '8px 24px' }}>
          Install
        </button>
      )}

      {/* Progress */}
      {installing && (
        <ProgressBar
          progress={progress}
          installPath={done ? installPath : undefined}
          onDone={() => window.installer.close()}
        />
      )}
    </div>
  );
};

const Checkbox: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <label style={{
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 13,
    color: disabled ? 'var(--text-muted)' : 'var(--text-primary)',
  }}>
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'inherit' }}
    />
    {label}
  </label>
);
