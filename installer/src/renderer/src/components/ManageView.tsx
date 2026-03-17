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
  const [mode,       setMode]       = useState<Mode>('idle');
  const [progress,   setProgress]   = useState<ProgressPayload | null>(null);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Title */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Minecraft Server Manager is already installed
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Installed version:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{installedVersion ?? 'unknown'}</strong>
          {bundledVersion !== installedVersion && (
            <> &nbsp;·&nbsp; Bundled version:{' '}
              <strong style={{ color: 'var(--accent)' }}>{bundledVersion}</strong>
            </>
          )}
        </div>
      </div>

      {/* Install path */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <span className="section-label">Installation Folder</span>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{installPath}</div>
        </div>
        <button className="btn btn-surface" onClick={() => window.installer.openFolder(installPath)}>
          Open
        </button>
      </div>

      {/* Action cards */}
      {mode === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ActionCard
            title="Repair Installation"
            description="Overwrite application files with the bundled version. Your servers and settings are kept."
            buttonLabel="Repair"
            buttonClass="btn-surface"
            onClick={handleRepair}
          />
          <ActionCard
            title="Uninstall"
            description="Remove the application from your system."
            buttonLabel="Uninstall"
            buttonClass="btn-danger"
            onClick={() => setMode('confirm-uninstall')}
          />
        </div>
      )}

      {/* Uninstall confirmation */}
      {mode === 'confirm-uninstall' && (
        <div className="panel" style={{ borderColor: 'rgba(248,113,113,0.2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            Confirm uninstall
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16 }}>
            <input
              type="checkbox"
              checked={removeData}
              onChange={(e) => setRemoveData(e.target.checked)}
              style={{ width: 15, height: 15, accentColor: 'var(--danger)' }}
            />
            Delete all servers, settings, and backups
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-surface" onClick={() => setMode('idle')}>Cancel</button>
            <button className="btn btn-danger" onClick={handleUninstall}>Yes, Uninstall</button>
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

const ActionCard: React.FC<{
  title: string;
  description: string;
  buttonLabel: string;
  buttonClass: string;
  onClick: () => void;
}> = ({ title, description, buttonLabel, buttonClass, onClick }) => (
  <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{description}</div>
    </div>
    <button className={`btn ${buttonClass}`} onClick={onClick}>{buttonLabel}</button>
  </div>
);
