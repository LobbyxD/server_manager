/**
 * PlayerInput – a text input with an inline autocomplete dropdown
 * that suggests names from the online players list.
 *
 * Typing narrows the suggestions; the user can also type any name freely
 * (e.g. for offline players that need to be banned or pardoned).
 */

import React, { useRef, useState, useCallback } from 'react';

interface PlayerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when Enter is pressed and no dropdown item is highlighted. */
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
  const [open, setOpen]         = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef                = useRef<HTMLInputElement>(null);

  // Filter suggestions: if the user has typed something, match by prefix
  // (case-insensitive); otherwise show all online players.
  const suggestions = players.filter((p) =>
    value.trim() === '' || p.toLowerCase().startsWith(value.toLowerCase()),
  );

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

  const handleBlur = () => {
    // Delay close so mouse-click on a suggestion fires first.
    setTimeout(() => setOpen(false), 120);
  };

  return (
    <div style={{ position: 'relative', ...style }}>
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
        style={{ width: '100%' }}
      />

      {open && suggestions.length > 0 && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            marginTop: 2,
            maxHeight: 160,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((name, i) => (
            <div
              key={name}
              onMouseDown={(e) => { e.preventDefault(); select(name); }}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                cursor: 'pointer',
                color: i === highlight ? 'var(--accent)' : 'var(--text-primary)',
                background: i === highlight ? 'var(--bg-surface)' : 'transparent',
                userSelect: 'none',
              }}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
