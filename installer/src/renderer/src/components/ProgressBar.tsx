import React from 'react';
import type { ProgressPayload } from '../../../preload/index';

interface Props {
  progress: ProgressPayload | null;
  onDone?: (installPath?: string) => void;
  installPath?: string;
}

export const ProgressBar: React.FC<Props> = ({ progress, onDone, installPath }) => {
  const done  = progress?.phase === 'done';
  const error = progress?.phase === 'error';
  const pct   = progress?.percent ?? 0;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Track */}
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 3,
            background: error ? '#e05252' : done ? '#4ade80' : '#4f8ef7',
            transition: 'width 0.25s ease, background 0.3s',
          }}
        />
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: 12,
          color: error ? '#e05252' : done ? '#4ade80' : 'rgba(255,255,255,0.55)',
          minHeight: 16,
        }}
      >
        {progress?.message ?? ''}
      </div>

      {/* Actions after completion */}
      {done && onDone && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {installPath && (
            <button
              onClick={() => window.installer.openFolder(installPath)}
              style={btnStyle('secondary')}
            >
              Open Folder
            </button>
          )}
          <button onClick={() => onDone(installPath)} style={btnStyle('primary')}>
            Finish
          </button>
        </div>
      )}
    </div>
  );
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
  };
}
