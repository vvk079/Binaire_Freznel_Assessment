import psList from 'ps-list';
import pidusage from 'pidusage';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  uid: string;
  cpu: number;
  memory: number;
  threads: number;
}

export type ProcessSortKey = 'cpu' | 'memory' | 'pid' | 'name' | 'threads';

/**
 * Known critical system processes that must be protected from accidental termination.
 */
const CRITICAL_PROCESS_NAMES = new Set([
  '[system process]',
  'system idle process',
  'system',
  'secure system',
  'registry',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'winlogon.exe',
  'fontdrvhost.exe',
  'init',
  'systemd',
  'kthreadd',
  'launchd',
  'kernel_task',
]);

/**
 * ProcessService: Encapsulates process listing, resource telemetry,
 * sorting, filtering, and guarded process termination.
 */
export class ProcessService {
  private prevProcessStats: Map<number, { cpuTime: number; timestamp: number }> = new Map();
  private isUpdating: boolean = false;
  private cachedProcesses: ProcessInfo[] | null = null;

  /**
   * Retrieves list of active system processes with CPU% and Memory usage.
   * Concurrency-guarded to prevent overlapping polling calls.
   */
  async getProcesses(): Promise<ProcessInfo[] | null> {
    if (this.isUpdating && this.cachedProcesses) {
      return this.cachedProcesses;
    }

    this.isUpdating = true;
    try {
      const list = await psList();
      if (!list || list.length === 0) {
        this.isUpdating = false;
        return this.cachedProcesses;
      }

      // 1. Attempt batch pidusage (supported on Linux, macOS, and Windows with wmic)
      let statsMap: Record<number, { cpu: number; memory: number }> = {};
      let pidusageSuccess = false;

      try {
        const pids = list.map((p) => p.pid);
        statsMap = await pidusage(pids);
        pidusageSuccess = Boolean(statsMap && Object.keys(statsMap).length > 0);
      } catch {
        pidusageSuccess = false;
      }

      if (pidusageSuccess) {
        const result = list.map((p) => {
          const s = statsMap[p.pid];
          return {
            pid: p.pid,
            name: p.name || 'Unknown',
            cmd: p.cmd || p.name || '',
            uid: String((p as any).uid ?? (p as any).user ?? 'SYSTEM'),
            cpu: s ? Math.min(100, Math.max(0, s.cpu)) : 0,
            memory: s ? s.memory : 0,
            threads: 1,
          };
        });
        this.cachedProcesses = result;
        this.isUpdating = false;
        return result;
      }

      // 2. Windows Fallback via PowerShell
      if (process.platform === 'win32') {
        const winStats = await this.getWindowsStats();
        const result = list.map((p) => {
          const ws = winStats.get(p.pid);
          return {
            pid: p.pid,
            name: p.name || 'Unknown',
            cmd: p.cmd || p.name || '',
            uid: String((p as any).uid ?? (p as any).user ?? 'SYSTEM'),
            cpu: ws ? Math.min(100, Math.max(0, ws.cpu)) : 0,
            memory: ws ? ws.memory : 0,
            threads: ws ? ws.threads : 1,
          };
        });
        this.cachedProcesses = result;
        this.isUpdating = false;
        return result;
      }

      // 3. Generic fallback
      const result = list.map((p) => ({
        pid: p.pid,
        name: p.name || 'Unknown',
        cmd: p.cmd || p.name || '',
        uid: 'user',
        cpu: 0,
        memory: 0,
        threads: 1,
      }));
      this.cachedProcesses = result;
      this.isUpdating = false;
      return result;
    } catch {
      this.isUpdating = false;
      return this.cachedProcesses;
    }
  }

  /**
   * Internal Windows process telemetry query using PowerShell.
   */
  private async getWindowsStats(): Promise<Map<number, { cpu: number; memory: number; threads: number }>> {
    const map = new Map<number, { cpu: number; memory: number; threads: number }>();
    try {
      const psScript = `Get-Process | ForEach-Object { "$($_.Id),$($_.WorkingSet64),$($_.CPU),$($_.Threads.Count)" }`;
      const { stdout } = await execPromise(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, {
        windowsHide: true,
        timeout: 2500,
      });

      const now = Date.now();
      const lines = stdout.trim().split(/\r?\n/);
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parseInt(parts[0]!, 10);
          if (isNaN(pid)) continue;

          const memory = parseInt(parts[1]!, 10) || 0;
          const cpuSeconds = parseFloat(parts[2]!) || 0;
          const threads = parseInt(parts[3]!, 10) || 1;

          let cpuPercent = 0;
          const prev = this.prevProcessStats.get(pid);
          if (prev) {
            const dt = (now - prev.timestamp) / 1000;
            if (dt > 0.4) {
              const dCpu = cpuSeconds - prev.cpuTime;
              cpuPercent = Math.max(0, Math.min(100, (dCpu / dt) * 100));
            }
          }
          this.prevProcessStats.set(pid, { cpuTime: cpuSeconds, timestamp: now });

          map.set(pid, { cpu: cpuPercent, memory, threads });
        }
      }
    } catch {
      // Return whatever metrics could be parsed
    }
    return map;
  }

  /**
   * Identifies whether a process is an essential operating system component.
   */
  isCriticalProcess(pid: number, name: string): boolean {
    if (pid <= 4) return true;
    if (pid === process.pid) return true; // Protect own monitor process
    const normalized = name.toLowerCase().trim();
    return CRITICAL_PROCESS_NAMES.has(normalized);
  }

  /**
   * Safely terminates a process with protection checks.
   */
  async killProcess(pid: number, name: string = ''): Promise<{ success: boolean; error?: string }> {
    if (this.isCriticalProcess(pid, name)) {
      return {
        success: false,
        error: `Cannot terminate critical system process: PID ${pid} (${name || 'Protected'})`,
      };
    }

    try {
      // First try standard process signal
      process.kill(pid);
      return { success: true };
    } catch (err: any) {
      // On Windows, try taskkill with force flag
      if (process.platform === 'win32') {
        try {
          await execPromise(`taskkill /PID ${pid} /F`, { windowsHide: true });
          return { success: true };
        } catch (taskkillErr: any) {
          const msg = String(taskkillErr?.stderr || taskkillErr?.message || '');
          if (msg.includes('Access is denied') || msg.includes('access denied')) {
            return {
              success: false,
              error: `Permission Denied: Administrator privileges required to terminate PID ${pid}`,
            };
          }
          if (msg.includes('not found') || msg.includes('No process')) {
            return {
              success: false,
              error: `Process PID ${pid} has already terminated`,
            };
          }
          return { success: false, error: `Failed to terminate PID ${pid}: ${msg || 'Unknown error'}` };
        }
      }

      const msg = String(err?.message || err);
      if (err?.code === 'EPERM') {
        return {
          success: false,
          error: `Permission Denied: Superuser (sudo) required to terminate PID ${pid}`,
        };
      }
      return { success: false, error: `Error terminating PID ${pid}: ${msg}` };
    }
  }

  /**
   * Sorts processes according to specified attribute.
   */
  sortProcesses(
    processes: ProcessInfo[],
    key: ProcessSortKey,
    descending: boolean = true
  ): ProcessInfo[] {
    return [...processes].sort((a, b) => {
      let av: number | string = a[key] ?? 0;
      let bv: number | string = b[key] ?? 0;

      if (typeof av === 'number' && typeof bv === 'number') {
        return descending ? bv - av : av - bv;
      }
      const cmp = String(av).localeCompare(String(bv));
      return descending ? -cmp : cmp;
    });
  }

  /**
   * Filters processes matching a query string across PID, Name, and Command line.
   */
  filterProcesses(processes: ProcessInfo[], query: string): ProcessInfo[] {
    if (!query.trim()) return processes;
    const q = query.toLowerCase().trim();
    return processes.filter(
      (p) =>
        String(p.pid).includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.cmd.toLowerCase().includes(q) ||
        p.uid.toLowerCase().includes(q)
    );
  }
}
