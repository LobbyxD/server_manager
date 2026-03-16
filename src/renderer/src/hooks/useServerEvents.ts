/**
 * Subscribes to IPC push events from the main process and routes them into
 * the Zustand store. Should be mounted once at the App level.
 */

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LogLine, ServerStatus } from '../../../shared/types';

/**
 * Strips leading bracket-style prefixes from a player name.
 * Minecraft usernames cannot contain '[', so anything like "[17] " or
 * "[Admin] " at the start is a mod-added display prefix, not the real name.
 * Handles multiple stacked prefixes, e.g. "[Admin][17] Lobbyx3" → "Lobbyx3".
 */
export function stripPlayerPrefix(name: string): string {
  return name.replace(/^(\[[^\]]*\]\s*)+/, '').trim();
}

/**
 * Parses the online-player list from a Minecraft 'list' command response.
 * Expected format: "There are X of a max of Y players online: name1, name2"
 * Returns an empty array if the line does not match.
 * Strips mod-added bracket prefixes from each name.
 */
export function parsePlayerList(line: string): string[] | null {
  const match = line.match(/players online:\s*(.+)$/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return [];
  return raw.split(',').map((n) => stripPlayerPrefix(n.trim())).filter(Boolean);
}

/**
 * Extracts a player name from a "X joined the game" log line.
 * Returns null if the line doesn't match.
 */
function parseJoinEvent(line: string): string | null {
  const match = line.match(/: (.+) joined the game$/);
  return match ? stripPlayerPrefix(match[1]) : null;
}

/**
 * Extracts a player name from a "X left the game" log line.
 * Returns null if the line doesn't match.
 */
function parseLeaveEvent(line: string): string | null {
  const match = line.match(/: (.+) left the game$/);
  return match ? stripPlayerPrefix(match[1]) : null;
}

export function useServerEvents(): void {
  const appendLog        = useAppStore((s) => s.appendLog);
  const setServerStatus  = useAppStore((s) => s.setServerStatus);
  const setOnlinePlayers = useAppStore((s) => s.setOnlinePlayers);
  const addOnlinePlayer  = useAppStore((s) => s.addOnlinePlayer);
  const removeOnlinePlayer = useAppStore((s) => s.removeOnlinePlayer);

  useEffect(() => {
    const unsubLog = window.api.onLog((serverId: string, line: LogLine) => {
      appendLog(serverId, line);

      if (line.type === 'out') {
        // Detect online player list from the 'list' command response
        const players = parsePlayerList(line.text);
        if (players !== null) {
          setOnlinePlayers(serverId, players);
          return;
        }

        // Live join detection
        const joined = parseJoinEvent(line.text);
        if (joined) {
          addOnlinePlayer(serverId, joined);
          return;
        }

        // Live leave detection
        const left = parseLeaveEvent(line.text);
        if (left) {
          removeOnlinePlayer(serverId, left);
        }
      }
    });

    const unsubStatus = window.api.onStatusChange(
      (serverId: string, status: string) => {
        setServerStatus(serverId, status as ServerStatus);
        // Clear online player list when the server stops
        if (status === 'stopped' || status === 'error') {
          setOnlinePlayers(serverId, []);
        }
      },
    );

    return () => {
      unsubLog();
      unsubStatus();
    };
  }, [appendLog, setServerStatus, setOnlinePlayers, addOnlinePlayer, removeOnlinePlayer]);
}
