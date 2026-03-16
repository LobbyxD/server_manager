/**
 * Server Settings Modal
 *
 * Two top-level tabs:
 *   • General      – Open Folder, Auto-Start, Auto-Backup, World Backups
 *   • Server Files – server.properties, eula.txt, Run Script, JVM Args
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BackupEntry, ServerProfile } from '../../../shared/types';
import { useAppStore } from '../store/useAppStore';

// ─── path helpers ─────────────────────────────────────────────────────────────

function getServerDir(batPath: string): string {
  return batPath.replace(/[/\\][^/\\]+$/, '');
}

// ─── property schema ─────────────────────────────────────────────────────────

type PropType = 'boolean' | 'number' | 'text' | 'enum' | 'password';

interface PropDef {
  key: string;
  label: string;
  desc: string;
  type: PropType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

interface CategoryDef {
  id: string;
  label: string;
  props: PropDef[];
}

const CATEGORIES: CategoryDef[] = [
  {
    id: 'network',
    label: 'Network',
    props: [
      { key: 'server-port', label: 'Port', desc: 'Port players connect to (default: 25565)', type: 'number', min: 1, max: 65535 },
      { key: 'server-ip', label: 'Bind IP', desc: 'Leave blank to accept connections on all network interfaces', type: 'text' },
      { key: 'max-players', label: 'Max Players', desc: 'Maximum number of players online simultaneously', type: 'number', min: 1, max: 2147483647 },
      { key: 'online-mode', label: 'Online Mode', desc: 'Require Mojang/Microsoft authentication. Disable only for offline/LAN use.', type: 'boolean' },
      { key: 'player-idle-timeout', label: 'Idle Timeout (min)', desc: 'Kick players after this many idle minutes. 0 = never kick.', type: 'number', min: 0 },
      { key: 'rate-limit', label: 'Rate Limit (packets/s)', desc: 'Max packets per second per player. 0 = unlimited.', type: 'number', min: 0 },
      { key: 'network-compression-threshold', label: 'Compression Threshold (bytes)', desc: 'Compress packets larger than this. −1 = off, 0 = compress all.', type: 'number', min: -1 },
      { key: 'prevent-proxy-connections', label: 'Block Proxy/VPN Connections', desc: 'Kick players who connect through a VPN or proxy server', type: 'boolean' },
    ],
  },
  {
    id: 'world',
    label: 'World',
    props: [
      { key: 'level-name', label: 'World Folder Name', desc: 'Name of the world save folder on disk', type: 'text' },
      { key: 'level-seed', label: 'World Seed', desc: 'Seed for world generation. Leave blank for a random seed.', type: 'text' },
      {
        key: 'level-type', label: 'World Type', desc: 'Type of terrain to generate', type: 'enum',
        options: [
          { value: 'minecraft:normal', label: 'Normal' },
          { value: 'minecraft:flat', label: 'Flat' },
          { value: 'minecraft:large_biomes', label: 'Large Biomes' },
          { value: 'minecraft:amplified', label: 'Amplified' },
          { value: 'default', label: 'Default (legacy)' },
          { value: 'flat', label: 'Flat (legacy)' },
          { value: 'largeBiomes', label: 'Large Biomes (legacy)' },
          { value: 'amplified', label: 'Amplified (legacy)' },
        ],
      },
      { key: 'generate-structures', label: 'Generate Structures', desc: 'Spawn villages, dungeons, ocean monuments, and other structures', type: 'boolean' },
      { key: 'spawn-protection', label: 'Spawn Protection Radius (blocks)', desc: 'Non-operators cannot modify blocks within this radius of spawn. 0 = disabled.', type: 'number', min: 0 },
      { key: 'max-world-size', label: 'Max World Radius (blocks)', desc: 'Maximum distance from 0,0 the world border can be placed', type: 'number', min: 1 },
    ],
  },
  {
    id: 'gameplay',
    label: 'Gameplay',
    props: [
      {
        key: 'gamemode', label: 'Default Gamemode', desc: 'Gamemode new players are assigned when they first join', type: 'enum',
        options: [
          { value: 'survival', label: 'Survival' },
          { value: 'creative', label: 'Creative' },
          { value: 'adventure', label: 'Adventure' },
          { value: 'spectator', label: 'Spectator' },
        ],
      },
      { key: 'force-gamemode', label: 'Force Gamemode', desc: 'Reset every player to the default gamemode each time they join', type: 'boolean' },
      {
        key: 'difficulty', label: 'Difficulty', desc: 'Game difficulty level', type: 'enum',
        options: [
          { value: 'peaceful', label: 'Peaceful' },
          { value: 'easy', label: 'Easy' },
          { value: 'normal', label: 'Normal' },
          { value: 'hard', label: 'Hard' },
        ],
      },
      { key: 'hardcore', label: 'Hardcore Mode', desc: 'Players are permanently banned from the server when they die', type: 'boolean' },
      { key: 'pvp', label: 'Player vs. Player (PvP)', desc: 'Allow players to damage each other in combat', type: 'boolean' },
      { key: 'allow-flight', label: 'Allow Flight', desc: 'Permit flight in Survival mode. Required by many mods and plugins.', type: 'boolean' },
      { key: 'allow-nether', label: 'Allow Nether', desc: 'Allow players to travel to the Nether dimension', type: 'boolean' },
      { key: 'spawn-monsters', label: 'Spawn Monsters', desc: 'Allow hostile mobs to spawn (creepers, zombies, skeletons, etc.)', type: 'boolean' },
      { key: 'spawn-animals', label: 'Spawn Animals', desc: 'Allow passive mobs to spawn (pigs, cows, sheep, etc.)', type: 'boolean' },
      { key: 'spawn-npcs', label: 'Spawn Villagers', desc: 'Allow NPC villagers to spawn in villages', type: 'boolean' },
    ],
  },
  {
    id: 'chat',
    label: 'Chat & Operators',
    props: [
      { key: 'motd', label: 'Server Description (MOTD)', desc: 'Text shown below the server name in the Minecraft server list. § color codes are supported.', type: 'text' },
      { key: 'enable-command-block', label: 'Enable Command Blocks', desc: 'Allow command blocks to execute commands in the world', type: 'boolean' },
      { key: 'op-permission-level', label: 'OP Permission Level (1–4)', desc: 'Default operator permission level. 4 = full access, 1 = bypass spawn protection only.', type: 'number', min: 1, max: 4 },
      { key: 'function-permission-level', label: 'Function Permission Level (1–4)', desc: 'Permission level required to run datapack functions', type: 'number', min: 1, max: 4 },
      { key: 'broadcast-console-to-ops', label: 'Broadcast Console to OPs', desc: 'Show server console output to operators who are online in-game', type: 'boolean' },
      { key: 'broadcast-rcon-to-ops', label: 'Broadcast RCON to OPs', desc: 'Show RCON command output to operators who are online in-game', type: 'boolean' },
      { key: 'enable-status', label: 'Appear in Server List', desc: 'Respond to server list pings so the server appears in Multiplayer', type: 'boolean' },
      { key: 'hide-online-players', label: 'Hide Online Player Count', desc: 'Show ??? instead of the real player count in the server list', type: 'boolean' },
      { key: 'enforce-secure-profile', label: 'Enforce Secure Chat (1.19+)', desc: 'Require players to have a Mojang-signed public key for chat signing', type: 'boolean' },
    ],
  },
  {
    id: 'access',
    label: 'Access & Security',
    props: [
      { key: 'white-list', label: 'Whitelist', desc: 'Only allow players on the whitelist to join the server', type: 'boolean' },
      { key: 'enforce-whitelist', label: 'Enforce Whitelist on Reload', desc: 'Kick currently online players who are not on the whitelist when it is reloaded', type: 'boolean' },
    ],
  },
  {
    id: 'performance',
    label: 'Performance',
    props: [
      { key: 'view-distance', label: 'View Distance (chunks)', desc: 'How many chunks the server sends around each player. Lower = better server performance. Range: 3–32.', type: 'number', min: 3, max: 32 },
      { key: 'simulation-distance', label: 'Simulation Distance (chunks)', desc: 'How far from players the server simulates game mechanics. Range: 3–32.', type: 'number', min: 3, max: 32 },
      { key: 'max-tick-time', label: 'Watchdog Timeout (ms)', desc: 'Max milliseconds a single tick can take before the watchdog crashes the server. −1 = disable watchdog.', type: 'number', min: -1 },
      { key: 'entity-broadcast-range-percentage', label: 'Entity Tracking Range (%)', desc: 'Scales how far entities are tracked and sent to players. 100 = default, lower saves bandwidth.', type: 'number', min: 10, max: 1000 },
      { key: 'sync-chunk-writes', label: 'Sync Chunk Writes', desc: 'Write chunk data to disk synchronously. Safer but slightly slower.', type: 'boolean' },
      { key: 'use-native-transport', label: 'Native Transport (Linux)', desc: 'Use Linux-native epoll network transport for better performance on Linux servers', type: 'boolean' },
    ],
  },
  {
    id: 'rcon',
    label: 'RCON & Query',
    props: [
      { key: 'enable-rcon', label: 'Enable RCON', desc: 'Allow remote console connections via the RCON protocol', type: 'boolean' },
      { key: 'rcon.port', label: 'RCON Port', desc: 'Port for RCON connections (default: 25575)', type: 'number', min: 1, max: 65535 },
      { key: 'rcon.password', label: 'RCON Password', desc: 'Password required to authenticate RCON connections', type: 'password' },
      { key: 'enable-query', label: 'Enable Query', desc: 'Enable GameSpy4 protocol listener used by some server list tools', type: 'boolean' },
      { key: 'query.port', label: 'Query Port', desc: 'Port for the query protocol listener', type: 'number', min: 1, max: 65535 },
    ],
  },
  {
    id: 'resourcepack',
    label: 'Resource Pack',
    props: [
      { key: 'resource-pack', label: 'Resource Pack URL', desc: 'Direct-download URL of the resource pack .zip to offer to players', type: 'text' },
      { key: 'resource-pack-sha1', label: 'SHA-1 Hash', desc: 'SHA-1 hash of the resource pack for integrity verification', type: 'text' },
      { key: 'resource-pack-prompt', label: 'Download Prompt', desc: 'Message shown to players when they are asked to download the resource pack', type: 'text' },
      { key: 'require-resource-pack', label: 'Require Resource Pack', desc: 'Kick players who decline to download the resource pack', type: 'boolean' },
    ],
  },
];

const ALL_KNOWN_KEYS = new Set(CATEGORIES.flatMap((c) => c.props.map((p) => p.key)));

// ─── parse / serialize ────────────────────────────────────────────────────────

interface ParsedLine {
  type: 'comment' | 'property' | 'blank';
  raw: string;
  key?: string;
  value?: string;
}

function parseProperties(content: string): ParsedLine[] {
  return content.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { type: 'blank' as const, raw: line };
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) return { type: 'comment' as const, raw: line };
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return { type: 'comment' as const, raw: line };
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1);
    return { type: 'property' as const, raw: line, key, value };
  });
}

function extractValues(lines: ParsedLine[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const l of lines) {
    if (l.type === 'property' && l.key != null) map[l.key] = l.value ?? '';
  }
  return map;
}

function serializeProperties(
  originalLines: ParsedLine[],
  values: Record<string, string>,
  deletedKeys: Set<string>,
): string {
  const originalKeys = new Set(
    originalLines.filter((l) => l.type === 'property' && l.key).map((l) => l.key as string),
  );
  const parts: string[] = [];

  for (const l of originalLines) {
    if (l.type === 'property' && l.key != null) {
      if (deletedKeys.has(l.key)) continue;
      parts.push(`${l.key}=${values[l.key] ?? l.value ?? ''}`);
    } else {
      parts.push(l.raw);
    }
  }

  for (const [k, v] of Object.entries(values)) {
    if (!originalKeys.has(k) && !deletedKeys.has(k) && v !== '') {
      parts.push(`${k}=${v}`);
    }
  }

  return parts.join('\n');
}

// ─── shared UI helpers ────────────────────────────────────────────────────────

interface TabFooterProps {
  isDirty: boolean;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onSave: () => void;
}

const TabFooter: React.FC<TabFooterProps> = ({ isDirty, saving, saved, error, onSave }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: 12,
      borderTop: '1px solid var(--border)',
      flexShrink: 0,
      gap: 8,
    }}
  >
    <span style={{ fontSize: 11, color: error ? 'var(--danger)' : saved ? 'var(--accent)' : 'var(--text-muted)', flex: 1 }}>
      {error ?? (saved ? 'Saved!' : isDirty ? 'Unsaved changes — Ctrl+S to save' : '')}
    </span>
    <button className="btn btn-primary" onClick={onSave} disabled={saving || !isDirty}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
);

const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      padding: '14px 0 5px',
      borderBottom: '1px solid var(--border)',
      marginBottom: 0,
    }}
  >
    {label}
  </div>
);

// ─── SettingRow – generic label + control row ─────────────────────────────────

const SettingRow: React.FC<{
  label: string;
  desc?: string;
  children: React.ReactNode;
  noBorder?: boolean;
}> = ({ label, desc, children, noBorder }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      padding: '10px 0',
      borderBottom: noBorder ? 'none' : '1px solid var(--border)',
    }}
  >
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
      {desc && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
    </div>
    <div style={{ flexShrink: 0 }}>{children}</div>
  </div>
);

// ─── PropRow ──────────────────────────────────────────────────────────────────

const PropRow: React.FC<{ def: PropDef; value: string; onChange: (v: string) => void }> = ({ def, value, onChange }) => {
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', gap: 16 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{def.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, lineHeight: 1.4 }}>{def.desc}</div>
      </div>
      <div style={{ flexShrink: 0, width: 210 }}>
        {def.type === 'boolean' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: value === 'true' ? 'var(--accent)' : 'var(--text-muted)' }}>
              {value === 'true' ? 'Enabled' : 'Disabled'}
            </span>
            <div className={`toggle-track ${value === 'true' ? 'on' : ''}`} onClick={() => onChange(value === 'true' ? 'false' : 'true')} style={{ cursor: 'pointer' }}>
              <div className="toggle-thumb" />
            </div>
          </div>
        )}
        {def.type === 'number' && (
          <input type="number" className="field" value={value} min={def.min} max={def.max} onChange={(e) => onChange(e.target.value)} style={{ textAlign: 'right' }} />
        )}
        {def.type === 'text' && (
          <input type="text" className="field" value={value} onChange={(e) => onChange(e.target.value)} />
        )}
        {def.type === 'password' && (
          <div style={{ display: 'flex', gap: 4 }}>
            <input type={showPwd ? 'text' : 'password'} className="field" value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-surface" onClick={() => setShowPwd((p) => !p)} style={{ padding: '4px 7px', fontSize: 11, flexShrink: 0 }}>
              {showPwd ? 'Hide' : 'Show'}
            </button>
          </div>
        )}
        {def.type === 'enum' && (
          <select className="field" value={value} onChange={(e) => onChange(e.target.value)} style={{ cursor: 'pointer' }}>
            {!def.options?.some((o) => o.value === value) && value !== '' && <option value={value}>{value}</option>}
            {value === '' && <option value="">— not set —</option>}
            {def.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
};

// ─── RunScriptTab ─────────────────────────────────────────────────────────────

const RunScriptTab: React.FC<{ path: string }> = ({ path }) => {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    window.api.readBatFile(path)
      .then((text) => { setContent(text); setOriginal(text); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [path]);

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      await window.api.writeBatFile(path, content);
      setOriginal(content); setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }, [path, content]);

  const isDirty = content !== original;

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8, overflow: 'hidden' }}
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (!saving && isDirty) handleSave(); } }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{path}</div>
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
      {!loading && (
        <>
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setSaved(false); }}
            spellCheck={false}
            style={{
              flex: 1, fontFamily: "'Consolas', 'Cascadia Code', 'Courier New', monospace",
              fontSize: 13, lineHeight: 1.6, padding: '10px 12px',
              background: 'var(--bg-primary)', color: 'var(--text-primary)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              resize: 'none', outline: 'none', overflowY: 'auto', whiteSpace: 'pre',
            }}
          />
          <TabFooter isDirty={isDirty} saving={saving} saved={saved} error={error} onSave={handleSave} />
        </>
      )}
    </div>
  );
};

// ─── ServerPropertiesTab ──────────────────────────────────────────────────────

const ServerPropertiesTab: React.FC<{ path: string }> = ({ path }) => {
  const [originalLines, setOriginalLines] = useState<ParsedLine[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({});
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const loadFile = useCallback(() => {
    setLoading(true); setError(null);
    window.api.readBatFile(path)
      .then((text) => {
        const lines = parseProperties(text);
        const vals = extractValues(lines);
        setOriginalLines(lines); setValues({ ...vals }); setOriginalValues({ ...vals });
        setDeletedKeys(new Set()); setLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [path]);

  useEffect(() => { loadFile(); }, [loadFile]);

  const setValue = useCallback((key: string, val: string) => { setSaved(false); setValues((prev) => ({ ...prev, [key]: val })); }, []);
  const deleteKey = useCallback((key: string) => { setDeletedKeys((prev) => new Set([...prev, key])); setSaved(false); }, []);

  const handleAddProp = useCallback(() => {
    const k = newKey.trim();
    if (!k) return;
    setValues((prev) => ({ ...prev, [k]: newVal }));
    setDeletedKeys((prev) => { const n = new Set(prev); n.delete(k); return n; });
    setNewKey(''); setNewVal(''); setSaved(false);
  }, [newKey, newVal]);

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const content = serializeProperties(originalLines, values, deletedKeys);
      await window.api.writeBatFile(path, content);
      const fresh = await window.api.readBatFile(path);
      const lines = parseProperties(fresh);
      const vals = extractValues(lines);
      setOriginalLines(lines); setOriginalValues({ ...vals }); setDeletedKeys(new Set());
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }, [path, originalLines, values, deletedKeys]);

  const isDirty = (() => {
    if (deletedKeys.size > 0) return true;
    for (const [k, v] of Object.entries(values)) { if (originalValues[k] !== v) return true; }
    return false;
  })();

  const unknownKeys = Object.keys(values).filter((k) => !ALL_KNOWN_KEYS.has(k) && !deletedKeys.has(k));

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', gap: 8 }}
      onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (!saving && isDirty) handleSave(); } }}
    >
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>Loading server.properties…</div>}
      {!loading && error && (
        <div style={{ color: 'var(--danger)', fontSize: 12, background: 'color-mix(in srgb, var(--danger) 10%, transparent)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)' }}>{error}</div>
      )}
      {!loading && !error && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6 }}>
            {CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <SectionHeader label={cat.label} />
                {cat.props.map((def) => (
                  <PropRow key={def.key} def={def} value={values[def.key] ?? ''} onChange={(v) => setValue(def.key, v)} />
                ))}
              </div>
            ))}
            {unknownKeys.length > 0 && (
              <div>
                <SectionHeader label="Custom / Mod Properties" />
                {unknownKeys.map((key) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', gap: 8 }}>
                    <code style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', flexShrink: 0, width: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{key}</code>
                    <input className="field" type="text" value={values[key] ?? ''} onChange={(e) => setValue(key, e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={() => deleteKey(key)} title="Remove this property" style={{ color: 'var(--danger)', flexShrink: 0, padding: '4px 8px' }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ paddingTop: 14, paddingBottom: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Add property:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="field" type="text" placeholder="property-name" value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddProp()} style={{ flex: '0 0 45%', fontFamily: 'monospace', fontSize: 12 }} />
                <input className="field" type="text" placeholder="value" value={newVal} onChange={(e) => setNewVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddProp()} style={{ flex: 1 }} />
                <button className="btn btn-surface" onClick={handleAddProp} disabled={!newKey.trim()} style={{ flexShrink: 0 }}>Add</button>
              </div>
            </div>
          </div>
          <TabFooter isDirty={isDirty} saving={saving} saved={saved} error={error} onSave={handleSave} />
        </>
      )}
    </div>
  );
};

// ─── EulaTab ──────────────────────────────────────────────────────────────────

const EulaTab: React.FC<{ path: string }> = ({ path }) => {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    window.api.readBatFile(path)
      .then((text) => { setContent(text); setOriginal(text); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [path]);

  const eulaAccepted = /^eula\s*=\s*true\s*$/im.test(content);
  const handleToggle = (val: boolean) => {
    setSaved(false);
    setContent((prev) => /^eula\s*=/im.test(prev) ? prev.replace(/^(eula\s*=\s*)(.*)$/im, `$1${val}`) : `${prev}\neula=${val}`);
  };

  const handleSave = async () => {
    setSaving(true); setError(null); setSaved(false);
    try { await window.api.writeBatFile(path, content); setOriginal(content); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const isDirty = content !== original;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12, overflow: 'hidden' }}>
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading eula.txt…</div>}
      {!loading && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: 18, borderRadius: 'var(--radius-sm)', background: eulaAccepted ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'color-mix(in srgb, var(--danger) 8%, transparent)', border: `1px solid ${eulaAccepted ? 'color-mix(in srgb, var(--accent) 25%, transparent)' : 'color-mix(in srgb, var(--danger) 25%, transparent)'}` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div className={`toggle-track ${eulaAccepted ? 'on' : ''}`} onClick={() => handleToggle(!eulaAccepted)} style={{ cursor: 'pointer', marginTop: 2, flexShrink: 0 }}>
                  <div className="toggle-thumb" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{eulaAccepted ? 'EULA Accepted' : 'EULA Not Accepted'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{eulaAccepted ? 'You have agreed to the Minecraft End User License Agreement. The server is allowed to start.' : 'You must accept the EULA before the Minecraft server will start. Enable the toggle above to agree.'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    By enabling this toggle you agree to Mojang's{' '}
                    <span style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => window.api.openExternal('https://aka.ms/MinecraftEULA')}>Minecraft End User License Agreement</span>.
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>Raw file content:</div>
              <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', margin: 0, overflowX: 'auto', userSelect: 'text' }}>{content}</pre>
            </div>
          </div>
          <TabFooter isDirty={isDirty} saving={saving} saved={saved} error={error} onSave={handleSave} />
        </>
      )}
    </div>
  );
};

// ─── JvmArgsTab ───────────────────────────────────────────────────────────────

const JvmArgsTab: React.FC<{ path: string }> = ({ path }) => {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true); setError(null);
    window.api.readBatFile(path)
      .then((text) => { setContent(text); setOriginal(text); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [path]);

  const handleSave = useCallback(async () => {
    setSaving(true); setError(null); setSaved(false);
    try { await window.api.writeBatFile(path, content); setOriginal(content); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }, [path, content]);

  const isDirty = content !== original;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 8, overflow: 'hidden' }} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (!saving && isDirty) handleSave(); } }}>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', lineHeight: 1.6, flexShrink: 0 }}>
        One JVM flag per line. Common flags:<br />
        <code style={{ fontFamily: 'monospace', color: 'var(--accent)', fontSize: 12 }}>-Xmx4G&nbsp;&nbsp;-Xms1G&nbsp;&nbsp;-XX:+UseG1GC&nbsp;&nbsp;-XX:+ParallelRefProcEnabled</code>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all', flexShrink: 0 }}>{path}</div>
      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>}
      {!loading && (
        <>
          <textarea value={content} onChange={(e) => { setContent(e.target.value); setSaved(false); }} spellCheck={false} style={{ flex: 1, fontFamily: "'Consolas', 'Cascadia Code', 'Courier New', monospace", fontSize: 13, lineHeight: 1.7, padding: '10px 12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', resize: 'none', outline: 'none', overflowY: 'auto', whiteSpace: 'pre' }} />
          <TabFooter isDirty={isDirty} saving={saving} saved={saved} error={error} onSave={handleSave} />
        </>
      )}
    </div>
  );
};

// ─── ServerFilesPanel – sub-tabbed file editors ───────────────────────────────

type FileTabId = 'properties' | 'eula' | 'script' | 'jvmargs';

const ServerFilesPanel: React.FC<{ server: ServerProfile }> = ({ server }) => {
  const [activeTab, setActiveTab] = useState<FileTabId>('properties');
  const [mountedTabs, setMountedTabs] = useState<Set<FileTabId>>(new Set(['properties']));

  const dir = getServerDir(server.batPath);
  const propertiesPath = dir + '\\server.properties';
  const eulaPath = dir + '\\eula.txt';

  const tabs: { id: FileTabId; label: string }[] = [
    { id: 'properties', label: 'server.properties' },
    { id: 'eula', label: 'eula.txt' },
    { id: 'script', label: 'Run Script' },
    ...(server.jvmArgsPath ? [{ id: 'jvmargs' as FileTabId, label: 'JVM Args' }] : []),
  ];

  const switchTab = (id: FileTabId) => {
    setActiveTab(id);
    setMountedTabs((prev) => new Set([...prev, id]));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Inner tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            style={{
              background: 'none', border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              padding: '7px 14px', fontSize: 12,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer', marginBottom: -1,
              fontFamily: 'inherit', transition: 'color 0.15s', outline: 'none',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: activeTab === 'properties' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          {mountedTabs.has('properties') && <ServerPropertiesTab path={propertiesPath} />}
        </div>
        <div style={{ display: activeTab === 'eula' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          {mountedTabs.has('eula') && <EulaTab path={eulaPath} />}
        </div>
        <div style={{ display: activeTab === 'script' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
          {mountedTabs.has('script') && <RunScriptTab path={server.batPath} />}
        </div>
        {server.jvmArgsPath && (
          <div style={{ display: activeTab === 'jvmargs' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            {mountedTabs.has('jvmargs') && <JvmArgsTab path={server.jvmArgsPath} />}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Backup confirm overlay ───────────────────────────────────────────────────

interface ConfirmOverlayProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmOverlay: React.FC<ConfirmOverlayProps> = ({ message, onConfirm, onCancel }) => (
  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius)', zIndex: 10 }}>
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 20, maxWidth: 340, textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
      <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: '0 0 16px', whiteSpace: 'pre-line' }}>{message}</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn-danger" onClick={onConfirm}>Confirm</button>
      </div>
    </div>
  </div>
);

// ─── Backup helpers ───────────────────────────────────────────────────────────

function formatBackupDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatBackupSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ─── GeneralTab ───────────────────────────────────────────────────────────────

const GeneralTab: React.FC<{ server: ServerProfile }> = ({ server }) => {
  const updateServer   = useAppStore((s) => s.updateServer);
  const serverStatuses = useAppStore((s) => s.serverStatuses);
  const isRunning = (serverStatuses[server.id] ?? 'stopped') === 'running';

  // Backup state
  const [backups, setBackups]               = useState<BackupEntry[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [creating, setCreating]             = useState(false);
  const [restoringPath, setRestoringPath]   = useState<string | null>(null);
  const [backupError, setBackupError]       = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess]   = useState<string | null>(null);
  const [confirm, setConfirm]               = useState<{ type: 'restore' | 'delete'; entry: BackupEntry } | null>(null);

  const loadBackups = useCallback(async () => {
    setBackupsLoading(true); setBackupError(null);
    try { setBackups(await window.api.listBackups(server.id)); }
    catch (e) { setBackupError((e as Error).message); }
    finally { setBackupsLoading(false); }
  }, [server.id]);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const showBackupSuccess = (msg: string) => { setBackupSuccess(msg); setTimeout(() => setBackupSuccess(null), 4000); };

  const handleToggle = async (field: 'autoStart' | 'autoBackup', val: boolean) => {
    const updated = { ...server, [field]: val };
    await window.api.updateProfile(updated);
    updateServer(updated);
  };

  const handleCreateBackup = async () => {
    setCreating(true); setBackupError(null);
    try {
      const entry = await window.api.createBackup(server.id);
      showBackupSuccess(`Backup created: ${entry.filename} (${formatBackupSize(entry.sizeBytes)})`);
      await loadBackups();
    } catch (e) { setBackupError((e as Error).message); }
    finally { setCreating(false); }
  };

  const handleRestore = async (entry: BackupEntry) => {
    setConfirm(null); setBackupError(null);
    setRestoringPath(entry.fullPath);
    try { await window.api.restoreBackup(server.id, entry.fullPath); showBackupSuccess(`Restored from: ${entry.filename}`); }
    catch (e) { setBackupError((e as Error).message); }
    finally { setRestoringPath(null); }
  };

  const handleDelete = async (entry: BackupEntry) => {
    setConfirm(null); setBackupError(null);
    try { await window.api.deleteBackup(server.id, entry.fullPath); showBackupSuccess(`Deleted: ${entry.filename}`); await loadBackups(); }
    catch (e) { setBackupError((e as Error).message); }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, position: 'relative' }}>
      {confirm && (
        <ConfirmOverlay
          message={confirm.type === 'restore'
            ? `Restore from "${confirm.entry.filename}"?\n\nThis will permanently replace your current world folder. Make sure the server is stopped.`
            : `Delete "${confirm.entry.filename}"?\nThis cannot be undone.`}
          onConfirm={() => confirm.type === 'restore' ? handleRestore(confirm.entry) : handleDelete(confirm.entry)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Server section ───────────────────────────────────── */}
      <SectionHeader label="Server" />

      <SettingRow label="Server Folder" desc="Open the server directory in File Explorer">
        <button className="btn btn-surface" onClick={() => window.api.openFolder(server.batPath)} style={{ gap: 6, fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Folder
        </button>
      </SettingRow>

      <SettingRow label="Auto-start" desc="Automatically start this server when the app launches">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: server.autoStart ? 'var(--accent)' : 'var(--text-muted)' }}>{server.autoStart ? 'ON' : 'OFF'}</span>
          <div className={`toggle-track ${server.autoStart ? 'on' : ''}`} onClick={() => handleToggle('autoStart', !server.autoStart)} style={{ cursor: 'pointer' }}>
            <div className="toggle-thumb" />
          </div>
        </div>
      </SettingRow>

      <SettingRow label="Auto-backup" desc="Create a world backup automatically every time the server stops" noBorder>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: server.autoBackup ? 'var(--accent)' : 'var(--text-muted)' }}>{server.autoBackup ? 'ON' : 'OFF'}</span>
          <div className={`toggle-track ${server.autoBackup ? 'on' : ''}`} onClick={() => handleToggle('autoBackup', !server.autoBackup)} style={{ cursor: 'pointer' }}>
            <div className="toggle-thumb" />
          </div>
        </div>
      </SettingRow>

      {/* ── World Backups section ────────────────────────────── */}
      <SectionHeader label="World Backups" />

      {/* Alerts */}
      {backupError && (
        <div style={{ fontSize: 12, color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', margin: '8px 0' }}>
          {backupError}
        </div>
      )}
      {backupSuccess && (
        <div style={{ fontSize: 12, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', margin: '8px 0' }}>
          {backupSuccess}
        </div>
      )}
      {isRunning && (
        <div style={{ fontSize: 12, color: '#f0a500', background: 'color-mix(in srgb, #f0a500 10%, transparent)', border: '1px solid color-mix(in srgb, #f0a500 25%, transparent)', borderRadius: 'var(--radius-sm)', padding: '6px 10px', margin: '8px 0' }}>
          Server is running — backups may capture an inconsistent world state. Restore is disabled while running.
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 0', alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={handleCreateBackup} disabled={creating || backupsLoading} style={{ gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {creating ? 'Creating backup…' : 'Create Backup'}
        </button>
        <button className="btn btn-surface" onClick={() => window.api.openBackupFolder(server.id)} style={{ gap: 6 }} title="Open World Backups folder">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          Open Backups Folder
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
          {backups.length} backup{backups.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Backup list */}
      {backupsLoading ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Loading…</div>
      ) : backups.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>No backups yet. Click "Create Backup" to make your first one.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {(['Date', 'World', 'Size', ''] as const).map((h) => (
                <th key={h} style={{ textAlign: h === '' ? 'right' : 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {backups.map((entry) => {
              const worldName = entry.filename.replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_/, '').replace(/\.zip$/, '');
              return (
                <tr key={entry.fullPath} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatBackupDate(entry.createdAt)}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-secondary)' }}>{worldName}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatBackupSize(entry.sizeBytes)}</td>
                  <td style={{ padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-surface"
                        style={{ gap: 5, fontSize: 11, padding: '3px 8px' }}
                        disabled={isRunning || restoringPath !== null}
                        title={isRunning ? 'Stop the server before restoring' : 'Replace current world with this backup'}
                        onClick={() => setConfirm({ type: 'restore', entry })}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.5" /></svg>
                        {restoringPath === entry.fullPath ? 'Restoring…' : 'Restore'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11, padding: '3px 8px' }}
                        title="Delete this backup"
                        onClick={() => setConfirm({ type: 'delete', entry })}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

// ─── ServerSettingsModal ──────────────────────────────────────────────────────

type OuterTabId = 'general' | 'serverfiles';

interface ServerSettingsModalProps {
  server: ServerProfile;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ server, onClose }) => {
  const [activeTab, setActiveTab] = useState<OuterTabId>('general');

  const outerTabs: { id: OuterTabId; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'serverfiles', label: 'Server Files' },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 900, maxWidth: '96vw', height: '84vh', maxHeight: 700, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px 0', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Server Settings</h2>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{server.name}</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: 6 }} title="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" /><line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        {/* ── Outer tab bar ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: 14, paddingLeft: 14, flexShrink: 0 }}>
          {outerTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                padding: '8px 18px', fontSize: 13,
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer', marginBottom: -1,
                fontFamily: 'inherit', transition: 'color 0.15s', outline: 'none',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '16px 22px 18px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: activeTab === 'general' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <GeneralTab server={server} />
          </div>
          <div style={{ display: activeTab === 'serverfiles' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
            <ServerFilesPanel server={server} />
          </div>
        </div>
      </div>
    </div>
  );
};
