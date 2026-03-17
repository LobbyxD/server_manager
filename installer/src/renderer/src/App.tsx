import React, { useEffect, useState } from 'react';
import { InstallView } from './components/InstallView';
import { ManageView } from './components/ManageView';

type DetectResult = {
  installed: boolean;
  installPath?: string;
  installedVersion?: string;
};

export const App: React.FC = () => {
  const [detect, setDetect]   = useState<DetectResult | null>(null);
  const [version, setVersion] = useState('1.0.0');

  useEffect(() => {
    Promise.all([
      window.installer.detect(),
      window.installer.getVersion(),
    ]).then(([d, v]) => {
      setDetect(d);
      setVersion(v);
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <img src="./icon.png" alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'contain' }} draggable={false} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.2 }}>
            Minecraft Server Manager
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
            Setup v{version}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
        {detect === null ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
            Detecting installation…
          </div>
        ) : detect.installed ? (
          <ManageView
            installPath={detect.installPath!}
            installedVersion={detect.installedVersion}
            bundledVersion={version}
          />
        ) : (
          <InstallView bundledVersion={version} />
        )}
      </div>
    </div>
  );
};
