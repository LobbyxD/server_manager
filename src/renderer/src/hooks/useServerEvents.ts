/**
 * Subscribes to IPC push events from the main process and routes them into
 * the Zustand store. Should be mounted once at the App level.
 */

import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { LogLine, ServerStatus } from '../../../shared/types';

/**
 * Parses the online-player list from a Minecraft 'list' command response.
 * Expected format: "There are X of a max of Y players online: name1, name2"
 * Returns an empty array if the line does not match.
 */
export function parsePlayerList(line: string): string[] | null {
  const match = line.match(/players online:\s*(.+)$/i);
  if (!match) return null;
  const raw = match[1].trim();
  if (!raw) return [];
  return raw.split(',').map((n) => n.trim()).filter(Boolean);
}

export function useServerEvents(): void {
  const appendLog = useAppStore((s) => s.appendLog);
  const setServerStatus = useAppStore((s) => s.setServerStatus);
  const setOnlinePlayers = useAppStore((s) => s.setOnlinePlayers);

  useEffect(() => {
    const unsubLog = window.api.onLog((serverId: string, line: LogLine) => {
      appendLog(serverId, line);

      // Detect online player list in stdout
      if (line.type === 'out') {
        const players = parsePlayerList(line.text);
        if (players !== null) {
          setOnlinePlayers(serverId, players);
        }
      }
    });

    const unsubStatus = window.api.onStatusChange(
      (serverId: string, status: string) => {
        setServerStatus(serverId, status as ServerStatus);
      },
    );

    return () => {
      unsubLog();
      unsubStatus();
    };
  }, [appendLog, setServerStatus, setOnlinePlayers]);
}
