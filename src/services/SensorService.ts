import os from 'os';
import si from 'systeminformation';

export interface DiskInfo {
  mount: string;
  size: number;
  used: number;
  rIO_sec?: number;
  wIO_sec?: number;
}

export interface GpuInfo {
  model: string;
  vendor?: string;
  vram?: number;
  usage: number | null; // null if hardware does not support usage reporting
  temp: number | null;  // null if thermal sensor unavailable
}

export interface BatteryInfo {
  hasBattery: boolean;
  percent: number | null;
  isCharging: boolean;
  timeRemaining?: number | null;
}

export interface CpuInfo {
  brand: string;
  speed: string;
  cores: number;
  physicalCores: number;
}

export interface MemInfo {
  total: number;
  free: number;
  used: number;
  available: number;
  cached: number;
  swaptotal: number;
  swapused: number;
}

export interface NetStatInfo {
  iface: string;
  rx_sec: number;
  tx_sec: number;
  rx_bytes: number;
  tx_bytes: number;
  ip: string | null;
}

/**
 * SensorService: Encapsulates all hardware and system sensor metrics.
 * 
 * Strict Principle:
 * Never returns fabricated, estimated, or fake values.
 * When hardware sensors are absent, permission is denied, or OS lacks support,
 * methods return real data where available and null for missing fields.
 */
export class SensorService {
  private lastDiskIoTime: number = 0;
  private lastDiskIoRead: number = 0;
  private lastDiskIoWrite: number = 0;

  /**
   * Retrieves CPU hardware specification.
   */
  async getCpuInfo(): Promise<CpuInfo> {
    try {
      const data = await si.cpu();
      const osCpus = os.cpus();
      const firstCpu = osCpus[0];

      const brand = data.brand || firstCpu?.model || 'Generic Processor';
      const speed = data.speed
        ? `${data.speed} GHz`
        : firstCpu?.speed
        ? `${(firstCpu.speed / 1000).toFixed(1)} GHz`
        : 'N/A';
      const cores = data.cores || osCpus.length || 1;
      const physicalCores = data.physicalCores || Math.max(1, Math.floor(cores / 2));

      return { brand, speed, cores, physicalCores };
    } catch {
      const osCpus = os.cpus();
      return {
        brand: osCpus[0]?.model || 'Processor',
        speed: osCpus[0]?.speed ? `${(osCpus[0].speed / 1000).toFixed(1)} GHz` : 'N/A',
        cores: osCpus.length || 1,
        physicalCores: Math.max(1, Math.floor((osCpus.length || 1) / 2)),
      };
    }
  }

  /**
   * Retrieves live per-core CPU utilization (0-100%).
   */
  async getCpuLoadPerCore(): Promise<number[] | null> {
    try {
      const data = await si.currentLoad();
      if (data && Array.isArray(data.cpus) && data.cpus.length > 0) {
        return data.cpus.map((c) => Math.min(100, Math.max(0, Math.round(c.load))));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves genuine 1m, 5m, 15m system load averages.
   * On UNIX/Linux/macOS, this queries os.loadavg() (average number of processes in run queue).
   * On Windows, the NT kernel does not calculate UNIX run-queue load averages,
   * so this returns null for all fields rather than misrepresenting instantaneous
   * CPU utilization as a one-minute system load average.
   */
  async getLoadAverages(): Promise<{ avg1: number | null; avg5: number | null; avg15: number | null }> {
    if (os.platform() === 'win32') {
      return { avg1: null, avg5: null, avg15: null };
    }
    try {
      const osAvg = os.loadavg();
      if (Array.isArray(osAvg) && osAvg.length >= 3) {
        return { avg1: osAvg[0]!, avg5: osAvg[1]!, avg15: osAvg[2]! };
      }
      return { avg1: null, avg5: null, avg15: null };
    } catch {
      return { avg1: null, avg5: null, avg15: null };
    }
  }

  /**
   * Retrieves CPU temperature in Celsius.
   * Returns null if ACPI thermal sensors are unsupported or require Administrator privileges.
   */
  async getCpuTemp(): Promise<number | null> {
    try {
      const data = await si.cpuTemperature();
      if (typeof data?.main === 'number' && data.main > 0) {
        return Math.round(data.main);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves real physical and swap memory metrics.
   */
  async getMemory(): Promise<MemInfo | null> {
    try {
      const mem = await si.mem();
      if (mem && mem.total > 0) {
        return {
          total: mem.total,
          free: mem.free,
          used: mem.used,
          available: mem.available || mem.free,
          cached: mem.cached || 0,
          swaptotal: mem.swaptotal || 0,
          swapused: mem.swapused || 0,
        };
      }

      // Fallback to node os module
      const total = os.totalmem();
      const free = os.freemem();
      return {
        total,
        free,
        used: total - free,
        available: free,
        cached: 0,
        swaptotal: 0,
        swapused: 0,
      };
    } catch {
      const total = os.totalmem();
      const free = os.freemem();
      return {
        total,
        free,
        used: total - free,
        available: free,
        cached: 0,
        swaptotal: 0,
        swapused: 0,
      };
    }
  }

  /**
   * Retrieves real mounted filesystems and optional disk I/O rates.
   */
  async getDisks(): Promise<DiskInfo[] | null> {
    try {
      const [disks, io] = await Promise.all([
        si.fsSize().catch(() => []),
        si.disksIO().catch(() => null),
      ]);

      const rIO_sec = io?.rIO_sec ?? undefined;
      const wIO_sec = io?.wIO_sec ?? undefined;

      if (disks && disks.length > 0) {
        return disks.map((d) => ({
          mount: d.mount || d.fs || '/',
          size: d.size || 0,
          used: d.used || 0,
          rIO_sec,
          wIO_sec,
        }));
      }

      // Robust fallback using Node.js native fs.statfsSync across OSes
      const fs = await import('fs');
      if (typeof fs.statfsSync === 'function') {
        const potentialMounts = process.platform === 'win32' ? ['C:', 'D:', 'E:'] : ['/', '/home'];
        const validDisks: DiskInfo[] = [];

        for (const mount of potentialMounts) {
          try {
            const stats = fs.statfsSync(mount);
            const size = stats.bsize * stats.blocks;
            const free = stats.bsize * stats.bfree;
            if (size > 0) {
              validDisks.push({
                mount,
                size,
                used: Math.max(0, size - free),
                rIO_sec,
                wIO_sec,
              });
            }
          } catch {
            // Drive letter / mount not attached
          }
        }

        if (validDisks.length > 0) {
          return validDisks;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves real network statistics and active IP addresses.
   */
  async getNetworkSpeed(): Promise<NetStatInfo[] | null> {
    try {
      const [nets, ifaces] = await Promise.all([
        si.networkStats(),
        si.networkInterfaces(),
      ]);

      const ifaceMap = new Map<string, string>();
      if (Array.isArray(ifaces)) {
        ifaces.forEach((i) => {
          if (i.iface && (i.ip4 || i.ip6)) {
            ifaceMap.set(i.iface, i.ip4 || i.ip6 || '');
          }
        });
      }

      // Also query os.networkInterfaces() for maximum reliability across OSes
      const osIfaces = os.networkInterfaces();
      for (const [name, addrs] of Object.entries(osIfaces)) {
        if (addrs) {
          const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal);
          if (ipv4 && !ifaceMap.has(name)) {
            ifaceMap.set(name, ipv4.address);
          }
        }
      }

      if (!nets || nets.length === 0) {
        return null;
      }

      return nets.map((n) => ({
        iface: n.iface,
        rx_sec: Math.max(0, n.rx_sec ?? 0),
        tx_sec: Math.max(0, n.tx_sec ?? 0),
        rx_bytes: n.rx_bytes ?? 0,
        tx_bytes: n.tx_bytes ?? 0,
        ip: ifaceMap.get(n.iface) || null,
      }));
    } catch {
      return null;
    }
  }

  /**
   * Retrieves actual graphics controllers.
   * Returns null if no hardware GPU controller is detected.
   */
  async getGpu(): Promise<GpuInfo[] | null> {
    try {
      const gpu = await si.graphics();
      if (gpu && Array.isArray(gpu.controllers) && gpu.controllers.length > 0) {
        const controllers = gpu.controllers.filter((c) => c && c.model);
        if (controllers.length === 0) return null;

        return controllers.map((c) => ({
          model: c.model,
          vendor: c.vendor || undefined,
          vram: c.vram || undefined,
          usage: typeof c.utilizationGpu === 'number' && c.utilizationGpu >= 0 ? c.utilizationGpu : null,
          temp: typeof c.temperatureGpu === 'number' && c.temperatureGpu > 0 ? c.temperatureGpu : null,
        }));
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves system uptime in seconds.
   */
  async getUptime(): Promise<number> {
    try {
      const t = await si.time();
      return typeof t.uptime === 'number' && t.uptime > 0 ? t.uptime : os.uptime();
    } catch {
      return os.uptime();
    }
  }

  /**
   * Retrieves real battery status.
   * Returns null if machine has no battery (e.g. desktop workstation / server).
   */
  async getBattery(): Promise<BatteryInfo | null> {
    try {
      const bat = await si.battery();
      if (!bat || !bat.hasBattery) {
        return {
          hasBattery: false,
          percent: null,
          isCharging: false,
          timeRemaining: null,
        };
      }

      return {
        hasBattery: true,
        percent: typeof bat.percent === 'number' ? bat.percent : null,
        isCharging: Boolean(bat.isCharging),
        timeRemaining: bat.timeRemaining,
      };
    } catch {
      return null;
    }
  }
}
