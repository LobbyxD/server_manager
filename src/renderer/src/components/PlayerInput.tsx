/**
 * PlayerInput – a combobox with text input + dropdown toggle.
 *
 * • Clicking the ▾ chevron opens/closes the full player list.
 * • Typing filters the list to matching names (prefix, case-insensitive).
 * • Arrow keys navigate the list; Enter selects or submits.
 * • Free-text entry is always allowed (e.g. offline players for ban/pardon).
 */

import React, { useRef, useState, useCallback } from 'react';

interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter is pressed with no dropdown item highlighted. */
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Online player names used as autocomplete suggestions. */
  players: string[];
  style?: React.CSSProperties;
}

export const PlayerInput: React.FC<PlayerInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Player name',
  disabled = false,
  players,
  style,
}) => {
  const [open, setOpen]           = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const containerRef              = useRef<HTMLDivElement>(null);

  // Filter by what's typed; empty input shows all players
  const suggestions = value.trim() === ''
    ? players
    : players.filter((p) => p.toLowerCase().startsWith(value.toLowerCase()));

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setHighlight(-1);
      inputRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Enter') onSubmit?.();
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setOpen(true);
        setHighlight(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => {
        const next = h - 1;
        if (next < 0) { setOpen(false); return -1; }
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && highlight < suggestions.length) {
        select(suggestions[highlight]);
      } else {
        setOpen(false);
        onSubmit?.();
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlight(-1);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setHighlight(-1);
    setOpen(true);
  };

  const handleFocus = () => {
    if (players.length > 0) setOpen(true);
  };

  // Delay close so mouse-click on a suggestion or the chevron fires first.
  const handleBlur = (e: React.FocusEvent) => {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setTimeout(() => setOpen(false), 120);
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setOpen((o) => !o);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      {/* ── Combobox row ──────────────────────────────────────────────── */}
      <div style={{ position: 'relative', display: 'flex' }}>
        <input
          ref={inputRef}
          className="field"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          autoComplete="off"
          style={{ flex: 1, paddingRight: players.length > 0 && !disabled ? 26 : undefined }}
        />

        {/* Chevron toggle — only shown when there are players to suggest */}
        {players.length > 0 && !disabled && (
          <button
            tabIndex={-1}
            onMouseDown={(e) => { e.preventDefault(); toggleDropdown(); }}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: open ? 'var(--accent)' : 'var(--text-muted)',
              padding: 0,
              transition: 'color 0.15s',
            }}
            title="Show online players"
          >
            {/* Chevron rotates when open */}
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
            >
              <polyline points="1,1 5,5 9,1" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Dropdown ──────────────────────────────────────────────────── */}
      {open && suggestions.length > 0 && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((name, i) => (
            <div
              key={name}
              onMouseDown={(e) => { e.preventDefault(); select(name); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer',
                color: i === highlight ? 'var(--accent)' : 'var(--text-primary)',
                background: i === highlight ? 'var(--bg-hover)' : 'transparent',
                userSelect: 'none',
                gap: 8,
              }}
            >
              {/* Small player dot */}
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, opacity: 0.7 }} />
              {name}
            </div>
          ))}
        </div>
      )}

      {/* Empty state dropdown when open but nothing matches typed text */}
      {open && suggestions.length === 0 && value.trim() !== '' && players.length > 0 && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            padding: '6px 10px',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}
        >
          No online player matches "{value}"
        </div>
      )}
    </div>
  );
};
