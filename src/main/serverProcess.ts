/**
 * ServerProcess wraps a child_process.spawn call for a Minecraft .bat/.cmd
 * start script. It:
 *  - Streams stdout/stderr as LogLine events.
 *  - Exposes sendCommand() to write to the server's stdin.
 *  - Detects "Done" in stdout to emit a 'started' event.
 *  - Gracefully stops the server by sending the 'stop' command, with a
 *    10-second SIGTERM fallback.
 */

import { EventEmitter } from 'events';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import path from 'path';
import { LogLine } from '../shared/types';

export class ServerProcess extends EventEmitter {
  private proc: ChildProcess | null = null;
  private serverId: string;
  private logCounter = 0;
  private stopTimer: NodeJS.Timeout | null = null;

  constructor(serverId: string) {
    super();
    this.serverId = serverId;
  }

  /** True when the child process is alive. */
  get isRunning(): boolean {
    return this.proc !== null && !this.proc.killed && this.proc.exitCode === null;
  }

  /** The PID of the spawned cmd.exe process, or undefined if not running. */
  get pid(): number | undefined {
    return this.proc?.pid;
  }

  /**
   * Spawns `cmd.exe /c <batName>` in the directory containing the .bat file,
   * with the console window hidden (windowsHide: true).
   */
  spawn(batPath: string): void {
    if (this.isRunning) return;

    const cwd = path.dirname(batPath);
    const batName = path.basename(batPath);

    this.proc = spawn('cmd.exe', ['/c', batName], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    this.proc.stdout?.setEncoding('utf8');
    this.proc.stderr?.setEncoding('utf8');

    let stdoutBuf = '';
    let stderrBuf = '';

    this.proc.stdout?.on('data', (chunk: string) => {
      stdoutBuf += chunk;
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          const logLine = this.createLogLine(line.trimEnd(), 'out');
          this.emit('log', logLine);
          // Detect server ready message
          if (line.includes('Done (') && line.includes('! For help, type "help"')) {
            this.emit('ready');
          }
        }
      }
    });

    this.proc.stderr?.on('data', (chunk: string) => {
      stderrBuf += chunk;
      const lines = stderrBuf.split('\n');
      stderrBuf = lines.pop() ?? '';
      for (const line of lines) {
        if (line.trim()) {
          this.emit('log', this.createLogLine(line.trimEnd(), 'err'));
        }
      }
    });

    this.proc.on('spawn', () => {
      this.emit('started');
    });

    this.proc.on('close', (code) => {
      if (this.stopTimer) {
        clearTimeout(this.stopTimer);
        this.stopTimer = null;
      }
      this.proc = null;
      this.emit('stopped', code);
    });

    this.proc.on('error', (err) => {
      this.proc = null;
      this.emit('error', err);
    });
  }

  /**
   * Writes a command string to the server's stdin followed by a newline.
   * No-ops if the process is not running.
   */
  sendCommand(cmd: string): void {
    if (!this.isRunning || !this.proc?.stdin) return;
    this.proc.stdin.write(cmd + '\r\n');
  }

  /**
   * Gracefully stops the server by sending the 'stop' command.
   * Falls back to taskkill /F /T after 10 seconds to ensure the full
   * process tree (cmd.exe + java.exe) is killed if it does not exit.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.sendCommand('stop');
    this.stopTimer = setTimeout(() => {
      if (this.isRunning) {
        const pid = this.proc?.pid;
        if (pid && process.platform === 'win32') {
          spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
        } else {
          this.proc?.kill('SIGTERM');
        }
      }
    }, 10_000);
  }

  /**
   * Stops the server (if running) and re-spawns it once stopped.
   * Returns a promise that resolves once the new process has spawned.
   */
  async restart(batPath: string): Promise<void> {
    if (this.isRunning) {
      this.stop();
      await new Promise<void>((resolve) => this.once('stopped', resolve));
    }
    this.spawn(batPath);
  }

  /**
   * Immediately and synchronously terminates the entire process tree.
   * Uses spawnSync so the kill is guaranteed to complete before this function
   * returns — critical for the before-quit handler.
   * On Windows: taskkill /F /T kills cmd.exe AND its java.exe child.
   */
  forceKill(): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    if (this.proc) {
      const pid = this.proc.pid;
      const proc = this.proc;
      this.proc = null;
      if (pid && process.platform === 'win32') {
        spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
      } else {
        proc.kill('SIGKILL');
      }
    }
  }

  private createLogLine(text: string, type: LogLine['type']): LogLine {
    return {
      id: ++this.logCounter,
      timestamp: new Date().toISOString(),
      text,
      type,
    };
  }
}
