import React, { useEffect, useState } from 'react';
import { InstallView } from './components/InstallView';
import { ManageView } from './components/ManageView';

type DetectResult = {
  installed: boolean;
  installPath?: string;
  installedVersion?: string;
};

const S = {
  root: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    objectFit: 'contain' as const,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 1,
  },
  body: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 24px',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
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
    <div style={S.root}>
      {/* Header */}
      <div style={S.header}>
        <img src="./icon.png" alt="" style={S.logo} draggable={false} />
        <div>
          <div style={S.title}>Minecraft Server Manager</div>
          <div style={S.subtitle}>Setup v{version}</div>
        </div>
      </div>

      {/* Body */}
      <div style={S.body}>
        {detect === null ? (
          <div style={S.loading}>Detecting installation…</div>
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
