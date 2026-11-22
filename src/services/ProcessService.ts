import psList from 'ps-list';
import pidusage from 'pidusage';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export interface ProcessInfo {
  pid: number;
  name: string;
  cmd: string;
  uid?: number | string;
  cpu?: number;
  memory?: number;
  threads?: number;
}

/**
 * Fetches and manages process information.
 * Uses ps-list for the process list and pidusage for CPU/memory stats,
 * with graceful fallback to PowerShell on modern Windows when wmic is absent.
 */
export class ProcessService {
  private prevProcessStats: Map<number, { cpuTime: number; timestamp: number }> = new Map();

  async getProcesses(): Promise<ProcessInfo[] | null> {
    try {
      const list = await psList();
      if (!list || list.length === 0) return null;

      // 1. Try batch pidusage first
      let statsMap: Record<number, { cpu: number; memory: number }> = {};
      let pidusageSuccess = false;

      try {
        const pids = list.map((p) => p.pid);
        statsMap = await pidusage(pids);
        pidusageSuccess = true;
      } catch {
        // pidusage failed (e.g. wmic missing on Windows 11)
        pidusageSuccess = false;
      }

      if (pidusageSuccess && Object.keys(statsMap).length > 0) {
        return list.map((p) => {
          const s = statsMap[p.pid];
          return {
            pid: p.pid,
            name: p.name,
            cmd: p.cmd ?? p.name,
            uid: (p as any).uid ?? (p as any).user ?? 'SYSTEM',
            cpu: s ? s.cpu : 0,
            memory: s ? s.memory : 0,
            threads: 1,
          };
        });
      }

      // 2. Windows fallback: Get WorkingSet (Memory) and CPU from PowerShell
      if (process.platform === 'win32') {
        const winStats = await this.getWindowsStats();
        return list.map((p) => {
          const ws = winStats.get(p.pid);
          return {
            pid: p.pid,
            name: p.name,
            cmd: p.cmd ?? p.name,
            uid: (p as any).uid ?? (p as any).user ?? 'SYSTEM',
            cpu: ws?.cpu ?? 0,
            memory: ws?.memory ?? 0,
            threads: ws?.threads ?? 1,
          };
        });
      }

      return list.map((p) => ({
        pid: p.pid,
        name: p.name,
        cmd: p.cmd ?? p.name,
        uid: 'user',
        cpu: 0,
        memory: 0,
        threads: 1,
      }));
    } catch {
      return null;
    }
  }

  private async getWindowsStats(): Promise<Map<number, { cpu: number; memory: number; threads: number }>> {
    const map = new Map<number, { cpu: number; memory: number; threads: number }>();
    try {
      const psScript = `Get-Process | ForEach-Object { "$($_.Id),$($_.WorkingSet64),$($_.CPU),$($_.Threads.Count)" }`;
      const { stdout } = await execPromise(`powershell -NoProfile -Command "${psScript}"`, {
        windowsHide: true,
        timeout: 2000,
      });

      const now = Date.now();
      const lines = stdout.trim().split(/\r?\n/);
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const pid = parseInt(parts[0], 10);
          const memory = parseInt(parts[1], 10) || 0;
          const cpuSeconds = parseFloat(parts[2]) || 0;
          const threads = parseInt(parts[3], 10) || 1;

          let cpuPercent = 0;
          const prev = this.prevProcessStats.get(pid);
          if (prev) {
            const dt = (now - prev.timestamp) / 1000;
            if (dt > 0.5) {
              const dCpu = cpuSeconds - prev.cpuTime;
              cpuPercent = Math.max(0, Math.min(100, (dCpu / dt) * 100));
            }
          }
          this.prevProcessStats.set(pid, { cpuTime: cpuSeconds, timestamp: now });

          map.set(pid, { cpu: cpuPercent, memory, threads });
        }
      }
    } catch {
      // return whatever is in map
    }
    return map;
  }

  sortProcesses<K extends keyof ProcessInfo>(
    processes: ProcessInfo[],
    key: K,
    descending: boolean = true
  ): ProcessInfo[] {
    return [...processes].sort((a, b) => {
      const av = a[key] as number | string | undefined;
      const bv = b[key] as number | string | undefined;
      if (av === undefined) return 1;
      if (bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return descending ? bv - av : av - bv;
      }
      const cmp = String(av).localeCompare(String(bv));
      return descending ? -cmp : cmp;
    });
  }

  filterProcesses(processes: ProcessInfo[], predicate: (p: ProcessInfo) => boolean): ProcessInfo[] {
    return processes.filter(predicate);
  }

  async killProcess(pid: number): Promise<boolean> {
    try {
      process.kill(pid);
      return true;
    } catch {
      return new Promise((resolve) => {
        exec(`taskkill /PID ${pid} /F`, (err) => resolve(!err));
      });
    }
  }
}
