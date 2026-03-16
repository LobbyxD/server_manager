/**
 * Real-time log viewer for the active server's stdout / stderr stream.
 * Features:
 *  - Auto-scroll to latest line (toggle-able).
 *  - Text search / filter.
 *  - Clear log button.
 *  - ANSI-aware colour hints (stdout vs stderr).
 *  - Adjustable font size from app settings.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LogLine, ServerStatus } from '../../../../../shared/types';

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Strips common ANSI escape codes from a log string. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '');
}

/** Formats an ISO-8601 timestamp to HH:MM:SS. */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconSearch = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconClear = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const IconArrowDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconSend = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

// ---------------------------------------------------------------------------
// Single log line rendering
// ---------------------------------------------------------------------------

interface LogRowProps {
  line: LogLine;
  fontSize: number;
  highlight: string;
}

const LogRow = React.memo<LogRowProps>(({ line, fontSize, highlight }) => {
  const text = stripAnsi(line.text);
  const isErr = line.type === 'err';
  const time  = formatTime(line.timestamp);

  let content: React.ReactNode = text;

  if (highlight) {
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    content = parts.map((p, i) =>
      p.toLowerCase() === highlight.toLowerCase() ? (
        <mark
          key={i}
          style={{ background: 'var(--warning)', color: '#000', borderRadius: 2, padding: '0 1px' }}
        >
          {p}
        </mark>
      ) : p,
    );
  }

  return (
    <div
      className="selectable"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '1px 12px',
        fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
        fontSize,
        lineHeight: 1.6,
        color: isErr ? 'var(--log-err)' : 'var(--log-out)',
        borderLeft: isErr ? '2px solid var(--danger)' : '2px solid transparent',
      }}
    >
      <span
        style={{
          color: 'var(--log-timestamp)',
          flexShrink: 0,
          fontSize: fontSize - 1,
          marginTop: 1,
          minWidth: 58,
        }}
      >
        {time}
      </span>
      <span style={{ wordBreak: 'break-all', flex: 1 }}>{content}</span>
    </div>
  );
});

LogRow.displayName = 'LogRow';

// ---------------------------------------------------------------------------
// LogViewer
// ---------------------------------------------------------------------------

export const LogViewer: React.FC = () => {
  const activeServerId  = useAppStore((s) => s.activeServerId);
  const serverLogs      = useAppStore((s) => s.serverLogs);
  const logLineCount    = useAppStore((s) => s.logLineCount);
  const serverStatuses  = useAppStore((s) => s.serverStatuses);
  const clearLogs       = useAppStore((s) => s.clearLogs);
  const fontSize        = useAppStore((s) => s.settings.fontSize);

  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter]         = useState('');
  const [cmd, setCmd]               = useState('');

  /** Circular command history for up/down arrow navigation (max 100 entries). */
  const historyRef  = useRef<string[]>([]);
  const histIdxRef  = useRef(-1);
  const cmdInputRef = useRef<HTMLInputElement>(null);

  const status: ServerStatus = (activeServerId && serverStatuses[activeServerId]) ?? 'stopped';
  const isRunning = status === 'running';

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawLines: LogLine[] = (activeServerId && serverLogs[activeServerId]) ?? [];
  const totalLines: number  = (activeServerId && logLineCount[activeServerId]) ?? 0;

  const lines = useMemo(() => {
    if (!filter.trim()) return rawLines;
    const lc = filter.toLowerCase();
    return rawLines.filter((l) => stripAnsi(l.text).toLowerCase().includes(lc));
  }, [rawLines, filter]);

  // Auto-scroll whenever lines change (if enabled).
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [lines, autoScroll]);

  // Detect manual scroll up to pause auto-scroll.
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    if (!atBottom && autoScroll) setAutoScroll(false);
  };

  const handleClear = () => {
    if (activeServerId) clearLogs(activeServerId);
  };

  const handleSendCmd = useCallback(async () => {
    const trimmed = cmd.trim();
    if (!trimmed || !activeServerId || !isRunning) return;

    // Push to history (avoid duplicate consecutive entries).
    if (historyRef.current[0] !== trimmed) {
      historyRef.current.unshift(trimmed);
      if (historyRef.current.length > 100) historyRef.current.pop();
    }
    histIdxRef.current = -1;

    setCmd('');
    await window.api.sendCommand(activeServerId, trimmed);
  }, [cmd, activeServerId, isRunning]);

  const handleCmdKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendCmd();
      return;
    }
    // Up arrow – older history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(histIdxRef.current + 1, historyRef.current.length - 1);
      histIdxRef.current = next;
      setCmd(historyRef.current[next] ?? '');
    }
    // Down arrow – newer history
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = histIdxRef.current - 1;
      histIdxRef.current = next;
      setCmd(next < 0 ? '' : (historyRef.current[next] ?? ''));
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        background: 'var(--log-bg)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}
      >
        <span className="section-label" style={{ marginRight: 4 }}>
          Console Log
        </span>

        {/* Filter input */}
        <div style={{ position: 'relative', flex: 1, maxWidth: 260 }}>
          <span
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          >
            <IconSearch />
          </span>
          <input
            className="field"
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: 28, fontSize: 12 }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Line count — shows total received; notes when buffer is trimmed */}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {filter.trim()
            ? `${lines.length.toLocaleString()} / ${rawLines.length.toLocaleString()} lines`
            : totalLines > rawLines.length
              ? `${rawLines.length.toLocaleString()} shown · ${totalLines.toLocaleString()} total`
              : `${totalLines.toLocaleString()} line${totalLines !== 1 ? 's' : ''}`}
        </span>

        {/* Auto-scroll toggle */}
        <button
          className={`btn ${autoScroll ? 'btn-primary' : 'btn-surface'}`}
          onClick={() => {
            const next = !autoScroll;
            setAutoScroll(next);
            if (next) bottomRef.current?.scrollIntoView({ block: 'end' });
          }}
          title="Toggle auto-scroll"
          style={{ gap: 4, fontSize: 11 }}
        >
          <IconArrowDown />
          Auto-scroll
        </button>

        {/* Clear */}
        <button
          className="btn btn-ghost"
          onClick={handleClear}
          title="Clear all log lines for this server"
        >
          <IconClear />
          Clear
        </button>
      </div>

      {/* Log lines */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '4px 0',
        }}
      >
        {lines.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
              fontFamily: '"Cascadia Code", "Consolas", monospace',
            }}
          >
            {activeServerId
              ? filter
                ? 'No lines match the filter.'
                : 'No output yet. Start the server to see logs here.'
              : 'Select a server from the sidebar.'}
          </div>
        ) : (
          lines.map((line) => (
            <LogRow key={line.id} line={line} fontSize={fontSize} highlight={filter.trim()} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command bar – pinned to bottom, styled like a terminal prompt */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          borderTop: '1px solid var(--border)',
          background: 'var(--log-bg)',
          flexShrink: 0,
          padding: '6px 8px',
        }}
      >
        {/* Terminal prompt symbol */}
        <span
          style={{
            fontFamily: '"Cascadia Code", "Consolas", monospace',
            fontSize: fontSize,
            color: isRunning ? 'var(--accent)' : 'var(--text-muted)',
            paddingRight: 8,
            paddingLeft: 4,
            userSelect: 'none',
            lineHeight: 1,
          }}
        >
          {'>'}
        </span>

        <input
          ref={cmdInputRef}
          className="field"
          type="text"
          placeholder={isRunning ? 'Send command…  (↑ ↓ history)' : 'Server is not running'}
          value={cmd}
          onChange={(e) => { setCmd(e.target.value); histIdxRef.current = -1; }}
          onKeyDown={handleCmdKeyDown}
          disabled={!isRunning}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
            fontSize: fontSize,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '4px 0',
            color: 'var(--text-primary)',
          }}
        />

        <button
          className="btn btn-primary"
          onClick={handleSendCmd}
          disabled={!isRunning || !cmd.trim()}
          style={{ padding: '4px 10px', flexShrink: 0 }}
          title="Send command (Enter)"
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
};
