import React from 'react';
import type { ProgressPayload } from '../../../preload/index';

interface Props {
  progress: ProgressPayload | null;
  onDone?: () => void;
  installPath?: string;
}

export const ProgressBar: React.FC<Props> = ({ progress, onDone, installPath }) => {
  const done  = progress?.phase === 'done';
  const error = progress?.phase === 'error';
  const pct   = progress?.percent ?? 0;

  const trackColor = error ? 'var(--danger)' : done ? 'var(--accent)' : 'var(--accent)';

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Track */}
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 2,
          background: trackColor,
          transition: 'width 0.25s ease, background 0.3s',
          opacity: error ? 0.6 : 1,
        }} />
      </div>

      {/* Message */}
      <div style={{ fontSize: 12, color: error ? 'var(--danger)' : done ? 'var(--accent)' : 'var(--text-secondary)' }}>
        {progress?.message ?? ''}
      </div>

      {/* Error detail */}
      {error && progress?.error && (
        <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.75)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
          {progress.error}
        </div>
      )}

      {/* Done actions */}
      {done && onDone && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {installPath && (
            <button className="btn btn-surface" onClick={() => window.installer.openFolder(installPath)}>
              Open Folder
            </button>
          )}
          <button className="btn btn-primary" onClick={onDone}>
            Finish
          </button>
        </div>
      )}
    </div>
  );
};
