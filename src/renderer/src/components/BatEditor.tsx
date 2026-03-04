/**
 * BAT File Editor modal.
 * Reads the server's .bat start script, lets the user edit it in a
 * full-height textarea, and saves it back to disk on Save.
 */

import React, { useEffect, useRef, useState } from 'react';

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

const IconSave = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

// ---------------------------------------------------------------------------
// BatEditor
// ---------------------------------------------------------------------------

interface BatEditorProps {
  batPath: string;
  onClose: () => void;
}

export const BatEditor: React.FC<BatEditorProps> = ({ batPath, onClose }) => {
  const [content, setContent]   = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [saved, setSaved]       = useState(false);
  const textareaRef             = useRef<HTMLTextAreaElement>(null);

  const fileName = batPath.split(/[\\/]/).pop() ?? batPath;
  const isDirty  = content !== original;

  // Load file on mount.
  useEffect(() => {
    setLoading(true);
    setError(null);
    window.api.readBatFile(batPath)
      .then((text) => {
        setContent(text);
        setOriginal(text);
        setLoading(false);
        // Focus the textarea after load.
        setTimeout(() => textareaRef.current?.focus(), 50);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [batPath]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await window.api.writeBatFile(batPath, content);
      setOriginal(content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+S saves while editing.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saving && isDirty) handleSave();
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ width: 720, maxWidth: '92vw', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
              Edit Script
            </h2>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {batPath}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6 }} title="Close">
            <IconClose />
          </button>
        </div>

        {/* Editor area */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            Loading {fileName}...
          </div>
        ) : error ? (
          <div style={{ padding: '12px', background: 'var(--danger)18', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaved(false); }}
            spellCheck={false}
            style={{
              flex: 1,
              minHeight: 340,
              maxHeight: '60vh',
              resize: 'vertical',
              fontFamily: "'Consolas', 'Cascadia Code', 'Courier New', monospace",
              fontSize: 13,
              lineHeight: 1.6,
              padding: '10px 12px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              overflowY: 'auto',
              whiteSpace: 'pre',
              overflowWrap: 'off' as React.CSSProperties['overflowWrap'],
            }}
          />
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: saved ? 'var(--accent)' : 'var(--text-muted)' }}>
            {saved ? 'Saved.' : isDirty ? 'Unsaved changes  (Ctrl+S to save)' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || loading || !isDirty}
            >
              {saving ? 'Saving...' : <><IconSave /> Save</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
