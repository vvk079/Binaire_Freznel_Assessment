import { SensorService } from './services/SensorService.js';
import { ProcessService } from './services/ProcessService.js';
import { HistoryBuffer } from './utils/HistoryBuffer.js';

const sensor = new SensorService();
const proc = new ProcessService();
const cpuHistory = new HistoryBuffer(60);

async function printMetrics(): Promise<void> {
  const [cpuLoad, cpuTemp, mem, nets, gpu, up, bat] = await Promise.all([
    sensor.getCpuLoadPerCore(),
    sensor.getCpuTemp(),
    sensor.getMemory(),
    sensor.getNetworkSpeed(),
    sensor.getGpu(),
    sensor.getUptime(),
    sensor.getBattery(),
  ]);

  const avgLoad = cpuLoad
    ? cpuLoad.reduce((a: number, b: number) => a + b, 0) / cpuLoad.length
    : null;
  if (avgLoad !== null) cpuHistory.push(avgLoad);

  console.clear();
  console.log('=== System Metrics ===');
  console.log('CPU cores (%):', cpuLoad ?? 'N/A');
  console.log('CPU avg (%):', avgLoad?.toFixed(2) ?? 'N/A');
  console.log('CPU temp (°C):', cpuTemp ?? 'N/A');

  if (mem) {
    console.log(
      `Memory: ${(mem.total / 1e6).toFixed(0)} MB total / ${(mem.used / 1e6).toFixed(0)} MB used`
    );
  }

  if (nets) {
    nets.forEach((n: { iface: string; rx_sec: number; tx_sec: number }) => {
      console.log(`Net ${n.iface}: ↓${(n.rx_sec / 1e3).toFixed(1)} KB/s ↑${(n.tx_sec / 1e3).toFixed(1)} KB/s`);
    });
  }

  console.log('GPU:', gpu ? gpu.map((g: { model: string }) => g.model).join(', ') : 'N/A');
  console.log('Uptime (s):', up ?? 'N/A');
  console.log('Battery:', bat?.hasBattery ? `${bat.percent}% ${bat.isCharging ? '(charging)' : ''}` : 'N/A');
  console.log('CPU history:', cpuHistory.get().map((v) => v.toFixed(1)).join(', '));

  const procs = await proc.getProcesses();
  if (procs) {
    const top5 = proc.sortProcesses(procs, 'cpu').reverse().slice(0, 5);
    console.log('\nTop 5 by CPU:');
    top5.forEach((p) => {
      console.log(
        `  PID:${p.pid} CPU:${p.cpu?.toFixed(1) ?? 'N/A'}% MEM:${p.memory != null ? (p.memory / 1e6).toFixed(0) : 'N/A'}MB ${p.name}`
      );
    });
  }
}

setInterval(() => { void printMetrics(); }, 1000);
void printMetrics();
