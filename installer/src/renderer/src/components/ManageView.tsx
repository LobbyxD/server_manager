import React, { useEffect, useState } from 'react';
import type { ProgressPayload } from '../../../preload/index';
import { ProgressBar } from './ProgressBar';

interface Props {
  installPath: string;
  installedVersion?: string;
  bundledVersion: string;
}

type Mode = 'idle' | 'confirm-uninstall' | 'working';

export const ManageView: React.FC<Props> = ({ installPath, installedVersion, bundledVersion }) => {
  const [mode,     setMode]     = useState<Mode>('idle');
  const [progress, setProgress] = useState<ProgressPayload | null>(null);
  const [removeData, setRemoveData] = useState(false);

  useEffect(() => {
    const unsub = window.installer.onProgress((p) => setProgress(p));
    return unsub;
  }, []);

  const handleRepair = () => {
    setMode('working');
    setProgress(null);
    window.installer.repair();
  };

  const handleUninstall = () => {
    setMode('working');
    setProgress(null);
    window.installer.uninstall({ removeData });
  };

  const done  = progress?.phase === 'done';

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 4 }}>
        Minecraft Server Manager is already installed
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>
        Installed version: <strong style={{ color: '#ddd' }}>{installedVersion ?? 'unknown'}</strong>
        {bundledVersion !== installedVersion && (
          <> &nbsp;·&nbsp; Bundled version: <strong style={{ color: '#4ade80' }}>{bundledVersion}</strong></>
        )}
      </div>

      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
        Installation folder
      </div>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{installPath}</span>
        <button onClick={() => window.installer.openFolder(installPath)} style={btnStyle('secondary', true)}>
          Open
        </button>
      </div>

      {/* Action cards */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ActionCard
            title="Repair Installation"
            description="Overwrite application files with the bundled version. Your servers and settings are kept."
            buttonLabel="Repair"
            buttonVariant="secondary"
            onClick={handleRepair}
          />

          <ActionCard
            title="Uninstall"
            description="Remove the application from your system."
            buttonLabel="Uninstall"
            buttonVariant="danger"
            onClick={() => setMode('confirm-uninstall')}
          />
        </div>
      )}

      {/* Uninstall confirmation */}
      {mode === 'confirm-uninstall' && (
        <div style={cardStyle}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
            Remove all data?
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#ddd', cursor: 'pointer', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={removeData}
              onChange={(e) => setRemoveData(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#e05252' }}
            />
            Delete all servers, settings, and backups stored by this app
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setMode('idle')} style={btnStyle('secondary')}>
              Cancel
            </button>
            <button onClick={handleUninstall} style={btnStyle('danger')}>
              Yes, Uninstall
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {mode === 'working' && (
        <ProgressBar
          progress={progress}
          onDone={() => window.installer.close()}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '16px',
};

const ActionCard: React.FC<{
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant: 'secondary' | 'danger';
  onClick: () => void;
}> = ({ title, description, buttonLabel, buttonVariant, onClick }) => (
  <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{description}</div>
    </div>
    <button onClick={onClick} style={btnStyle(buttonVariant)}>
      {buttonLabel}
    </button>
  </div>
);

function btnStyle(variant: 'primary' | 'secondary' | 'danger', small = false): React.CSSProperties {
  const bg =
    variant === 'primary'   ? '#4f8ef7' :
    variant === 'danger'    ? '#c0392b' :
    'rgba(255,255,255,0.08)';
  return {
    padding: small ? '5px 12px' : '7px 16px',
    borderRadius: 6,
    border: 'none',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: bg,
    color: '#fff',
    whiteSpace: 'nowrap',
  };
}
