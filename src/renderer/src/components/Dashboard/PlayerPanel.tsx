/**
 * Player management panel.
 * Sections:
 *  1. Online Players  – refresh list, kick selected player.
 *  2. Operator        – OP, De-OP.
 *  3. Whitelist       – toggle on/off, add/remove/reload.
 *  4. Ban & Pardon    – ban, ban-ip, pardon, pardon-ip.
 *  5. Server Commands – say (broadcast), time, weather, save.
 *
 * Raw command input has moved to the command bar below the log viewer.
 * All player-name inputs use PlayerInput autocomplete.
 */

import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { PlayerInput } from '../PlayerInput';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AlertType = 'success' | 'error' | 'info';
interface Alert { msg: string; type: AlertType }

function useAlert() {
  const [alert, setAlert] = useState<Alert | null>(null);

  const show = (msg: string, type: AlertType = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3000);
  };

  return { alert, show };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
    <div className="section-label" style={{ marginBottom: 8 }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {children}
    </div>
  </div>
);

interface RowProps { children: React.ReactNode }
const Row: React.FC<RowProps> = ({ children }) => (
  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{children}</div>
);

// ---------------------------------------------------------------------------
// PlayerPanel
// ---------------------------------------------------------------------------

export const PlayerPanel: React.FC = () => {
  const activeServerId = useAppStore((s) => s.activeServerId);
  const serverStatuses = useAppStore((s) => s.serverStatuses);
  const onlinePlayers  = useAppStore((s) => s.onlinePlayers);

  const { alert, show } = useAlert();

  // Input states
  const [kickName, setKickName]         = useState('');
  const [opName, setOpName]             = useState('');
  const [wlAddName, setWlAddName]       = useState('');
  const [wlRemoveName, setWlRemoveName] = useState('');
  const [banName, setBanName]           = useState('');

  const [banReason, setBanReason]       = useState('');
  const [pardonName, setPardonName]     = useState('');
  const [sayMsg, setSayMsg]             = useState('');

  const status    = (activeServerId && serverStatuses[activeServerId]) ?? 'stopped';
  const isRunning = status === 'running';
  const players   = (activeServerId && onlinePlayers[activeServerId]) ?? [];

  /** Sends a command to the active server and shows feedback. */
  const send = async (cmd: string, successMsg?: string) => {
    if (!activeServerId || !isRunning) return;
    try {
      await window.api.sendCommand(activeServerId, cmd);
      if (successMsg) show(successMsg);
    } catch (e) {
      show((e as Error).message, 'error');
    }
  };

  // ---- Online Players ----
  const handleList = () => send('list', 'Player list requested – check the log.');

  const handleKick = async () => {
    if (!kickName.trim()) { show('Enter a player name to kick.', 'error'); return; }
    await send(`kick ${kickName.trim()}`, `Kicked ${kickName.trim()}.`);
    setKickName('');
  };

  // ---- Operator ----
  const handleOp = async () => {
    if (!opName.trim()) { show('Enter a player name.', 'error'); return; }
    await send(`op ${opName.trim()}`, `Granted OP to ${opName.trim()}.`);
    setOpName('');
  };

  const handleDeop = async () => {
    if (!opName.trim()) { show('Enter a player name.', 'error'); return; }
    await send(`deop ${opName.trim()}`, `Removed OP from ${opName.trim()}.`);
    setOpName('');
  };

  // ---- Whitelist ----
  const handleWlAdd = async () => {
    if (!wlAddName.trim()) { show('Enter a player name.', 'error'); return; }
    await send(`whitelist add ${wlAddName.trim()}`, `Added ${wlAddName.trim()} to whitelist.`);
    setWlAddName('');
  };

  const handleWlRemove = async () => {
    if (!wlRemoveName.trim()) { show('Enter a player name.', 'error'); return; }
    await send(`whitelist remove ${wlRemoveName.trim()}`, `Removed ${wlRemoveName.trim()} from whitelist.`);
    setWlRemoveName('');
  };

  // ---- Ban & Pardon ----
  const handleBan = async () => {
    if (!banName.trim()) { show('Enter a player name.', 'error'); return; }
    const cmd = banReason.trim()
      ? `ban ${banName.trim()} ${banReason.trim()}`
      : `ban ${banName.trim()}`;
    await send(cmd, `Banned ${banName.trim()}.`);
    setBanName('');
    setBanReason('');
  };

  const handleBanIp = async () => {
    if (!banName.trim()) { show('Enter a player name or IP.', 'error'); return; }
    await send(`ban-ip ${banName.trim()}`, `Banned IP of ${banName.trim()}.`);
    setBanName('');
    setBanReason('');
  };

  const handlePardon = async () => {
    if (!pardonName.trim()) { show('Enter a player name.', 'error'); return; }
    await send(`pardon ${pardonName.trim()}`, `Unbanned ${pardonName.trim()}.`);
    setPardonName('');
  };

  const handlePardonIp = async () => {
    if (!pardonName.trim()) { show('Enter a player name or IP.', 'error'); return; }
    await send(`pardon-ip ${pardonName.trim()}`, `Unbanned IP of ${pardonName.trim()}.`);
    setPardonName('');
  };

  // ---- Server Commands ----
  const handleSay = async () => {
    if (!sayMsg.trim()) { show('Enter a message.', 'error'); return; }
    await send(`say ${sayMsg.trim()}`, 'Message broadcast.');
    setSayMsg('');
  };

  const alertColor = alert?.type === 'error'
    ? 'var(--danger)'
    : alert?.type === 'info'
    ? 'var(--info)'
    : 'var(--accent)';

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Panel header */}
      <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
        <span className="section-label">Player Controls</span>
        {!isRunning && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Server must be running.
          </div>
        )}
      </div>

      {/* Alert banner */}
      {alert && (
        <div style={{ padding: '6px 14px', fontSize: 11, color: alertColor, background: `${alertColor}18`, borderBottom: '1px solid var(--border)' }}>
          {alert.msg}
        </div>
      )}

      {/* ---- Online Players ---- */}
      <Section title="Online Players">
        <PlayerInput
          value={kickName}
          onChange={setKickName}
          onSubmit={handleKick}
          placeholder={players.length === 0 ? '(no players online)' : 'Select or type player'}
          disabled={!isRunning}
          players={players}
        />
        <Row>
          <button className="btn btn-surface" onClick={handleList} disabled={!isRunning} style={{ flex: 1 }}>
            Refresh List
          </button>
          <button className="btn btn-danger" onClick={handleKick} disabled={!isRunning || !kickName.trim()} style={{ flex: 1 }}>
            Kick
          </button>
        </Row>
      </Section>

      {/* ---- Operator ---- */}
      <Section title="Operator">
        <PlayerInput
          value={opName}
          onChange={setOpName}
          onSubmit={handleOp}
          placeholder="Player name"
          disabled={!isRunning}
          players={players}
        />
        <Row>
          <button className="btn btn-primary" onClick={handleOp} disabled={!isRunning} style={{ flex: 1 }}>
            Grant OP
          </button>
          <button className="btn btn-surface" onClick={handleDeop} disabled={!isRunning} style={{ flex: 1 }}>
            Revoke OP
          </button>
        </Row>
      </Section>

      {/* ---- Whitelist ---- */}
      <Section title="Whitelist">
        <Row>
          <button className="btn btn-primary" onClick={() => send('whitelist on', 'Whitelist enabled.')} disabled={!isRunning} style={{ flex: 1 }}>
            Enable
          </button>
          <button className="btn btn-surface" onClick={() => send('whitelist off', 'Whitelist disabled.')} disabled={!isRunning} style={{ flex: 1 }}>
            Disable
          </button>
        </Row>
        <PlayerInput
          value={wlAddName}
          onChange={setWlAddName}
          onSubmit={handleWlAdd}
          placeholder="Add player to whitelist"
          disabled={!isRunning}
          players={players}
        />
        <button className="btn btn-surface" onClick={handleWlAdd} disabled={!isRunning}>
          Add
        </button>
        <PlayerInput
          value={wlRemoveName}
          onChange={setWlRemoveName}
          onSubmit={handleWlRemove}
          placeholder="Remove from whitelist"
          disabled={!isRunning}
          players={players}
        />
        <Row>
          <button className="btn btn-ghost" onClick={handleWlRemove} disabled={!isRunning} style={{ flex: 1 }}>
            Remove
          </button>
          <button className="btn btn-ghost" onClick={() => send('whitelist reload', 'Whitelist reloaded.')} disabled={!isRunning} style={{ flex: 1 }}>
            Reload
          </button>
        </Row>
      </Section>

      {/* ---- Ban & Pardon ---- */}
      <Section title="Ban & Pardon">
        <PlayerInput
          value={banName}
          onChange={setBanName}
          onSubmit={handleBan}
          placeholder="Player name or IP"
          disabled={!isRunning}
          players={players}
        />
        <input
          className="field"
          type="text"
          placeholder="Ban reason (optional)"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          disabled={!isRunning}
          onKeyDown={(e) => e.key === 'Enter' && handleBan()}
        />
        <Row>
          <button className="btn btn-danger" onClick={handleBan} disabled={!isRunning} style={{ flex: 1 }}>
            Ban
          </button>
          <button className="btn btn-surface" onClick={handleBanIp} disabled={!isRunning} style={{ flex: 1 }}>
            Ban-IP
          </button>
        </Row>
        <PlayerInput
          value={pardonName}
          onChange={setPardonName}
          onSubmit={handlePardon}
          placeholder="Player name or IP"
          disabled={!isRunning}
          players={players}
        />
        <Row>
          <button className="btn btn-primary" onClick={handlePardon} disabled={!isRunning} style={{ flex: 1 }}>
            Unban
          </button>
          <button className="btn btn-surface" onClick={handlePardonIp} disabled={!isRunning} style={{ flex: 1 }}>
            Unban-IP
          </button>
        </Row>
        <Row>
          <button className="btn btn-ghost" onClick={() => send('banlist players', 'Banlist requested.')} disabled={!isRunning} style={{ flex: 1, fontSize: 11 }}>
            List Bans
          </button>
          <button className="btn btn-ghost" onClick={() => send('banlist ips', 'IP banlist requested.')} disabled={!isRunning} style={{ flex: 1, fontSize: 11 }}>
            List IP Bans
          </button>
        </Row>
      </Section>

      {/* ---- Server Commands ---- */}
      <Section title="Server Commands">
        <input
          className="field"
          type="text"
          placeholder="Broadcast message (say)"
          value={sayMsg}
          onChange={(e) => setSayMsg(e.target.value)}
          disabled={!isRunning}
          onKeyDown={(e) => e.key === 'Enter' && handleSay()}
        />
        <button className="btn btn-surface" onClick={handleSay} disabled={!isRunning}>
          Broadcast
        </button>

        <Row>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Time:</span>
          <button className="btn btn-surface" onClick={() => send('time set day', 'Time set to day.')} disabled={!isRunning} style={{ flex: 1 }}>Day</button>
          <button className="btn btn-surface" onClick={() => send('time set night', 'Time set to night.')} disabled={!isRunning} style={{ flex: 1 }}>Night</button>
        </Row>

        <Row>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Weather:</span>
          <button className="btn btn-surface" onClick={() => send('weather clear', 'Weather cleared.')} disabled={!isRunning} style={{ flex: 1 }}>Clear</button>
          <button className="btn btn-surface" onClick={() => send('weather rain', 'Weather set to rain.')} disabled={!isRunning} style={{ flex: 1 }}>Rain</button>
        </Row>

        <button className="btn btn-surface" onClick={() => send('save-all', 'World saved.')} disabled={!isRunning}>
          Save World
        </button>
      </Section>

    </div>
  );
};
