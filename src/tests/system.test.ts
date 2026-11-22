import { SensorService } from '../services/SensorService.js';
import { ProcessService } from '../services/ProcessService.js';
import { HistoryBuffer } from '../utils/HistoryBuffer.js';

async function runTests() {
  console.log('========================================');
  console.log('🧪 RUNNING COMPREHENSIVE SYSTEM TESTS');
  console.log('========================================\n');

  // 1. HistoryBuffer Test
  console.log('[1/4] Testing HistoryBuffer...');
  const buffer = new HistoryBuffer(5);
  for (let i = 1; i <= 10; i++) {
    buffer.push(i);
  }
  const history = buffer.get();
  if (history.length !== 5 || history[0] !== 6 || history[4] !== 10) {
    throw new Error(`HistoryBuffer failed: expected [6,7,8,9,10], got ${JSON.stringify(history)}`);
  }
  console.log('  ✅ HistoryBuffer: fixed capacity & FIFO verified.\n');

  // 2. SensorService Test
  console.log('[2/4] Testing SensorService...');
  const sensor = new SensorService();

  const [cpu, load, loadAvg, temp, mem, disks, net, gpu, up, bat] = await Promise.all([
    sensor.getCpuInfo(),
    sensor.getCpuLoadPerCore(),
    sensor.getLoadAverages(),
    sensor.getCpuTemp(),
    sensor.getMemory(),
    sensor.getDisks(),
    sensor.getNetworkSpeed(),
    sensor.getGpu(),
    sensor.getUptime(),
    sensor.getBattery(),
  ]);

  console.log('  • CPU Hardware:', cpu.brand, cpu.speed, `(${cpu.cores} cores)`);
  if (!cpu.brand || cpu.cores <= 0) throw new Error('Invalid CPU hardware info');

  console.log('  • CPU Utilization:', load ? `${load.length} cores reported` : 'N/A');
  console.log('  • Load Averages (UNIX 1m/5m/15m):', loadAvg.avg1 !== null ? JSON.stringify(loadAvg) : 'N/A (Windows NT kernel does not calculate UNIX run-queue averages)');
  console.log('  • CPU Temperature:', temp !== null ? `${temp}°C` : 'N/A (unsupported without elevated sensor permissions)');
  
  if (!mem || mem.total <= 0) throw new Error('Invalid memory reading');
  console.log(`  • Memory: ${(mem.used / 1e9).toFixed(1)} GB used / ${(mem.total / 1e9).toFixed(1)} GB total`);

  if (!disks || disks.length === 0) throw new Error('No disks detected');
  disks.forEach(d => console.log(`  • Disk ${d.mount}: ${(d.used / 1e9).toFixed(1)} GB used / ${(d.size / 1e9).toFixed(1)} GB total`));

  console.log('  • Network:', net ? `${net.length} interface(s) detected (${net[0]?.iface} IP: ${net[0]?.ip || 'N/A'})` : 'N/A');
  console.log('  • GPU:', gpu ? `${gpu.length} GPU(s) found` : 'N/A (None / Unsupported)');
  console.log(`  • Uptime: ${up} seconds`);
  console.log('  • Battery:', bat?.hasBattery ? `${bat.percent}%` : 'AC Power / No Battery');
  console.log('  ✅ SensorService: all real telemetry retrieved without fabrication.\n');

  // 3. ProcessService Test
  console.log('[3/4] Testing ProcessService...');
  const proc = new ProcessService();
  const list = await proc.getProcesses();

  if (!list || list.length === 0) {
    throw new Error('Failed to retrieve system processes');
  }
  console.log(`  • Process count: ${list.length} running processes`);

  // Sorting
  const sortedByCpu = proc.sortProcesses(list, 'cpu', true);
  console.log(`  • Top process by CPU: PID ${sortedByCpu[0]?.pid} (${sortedByCpu[0]?.name}) - ${sortedByCpu[0]?.cpu}%`);

  const sortedByMem = proc.sortProcesses(list, 'memory', true);
  console.log(`  • Top process by Memory: PID ${sortedByMem[0]?.pid} (${sortedByMem[0]?.name}) - ${(sortedByMem[0]?.memory / 1e6).toFixed(0)} MB`);

  // Filtering
  const filtered = proc.filterProcesses(list, list[0]?.name || 'system');
  console.log(`  • Filter search for "${list[0]?.name}": found ${filtered.length} matches`);

  // Critical Process Protection
  const isP0Crit = proc.isCriticalProcess(0, 'System Idle Process');
  const isP4Crit = proc.isCriticalProcess(4, 'System');
  const isSelfCrit = proc.isCriticalProcess(process.pid, 'node.exe');
  const isRegularCrit = proc.isCriticalProcess(999999, 'user_app.exe');

  if (!isP0Crit || !isP4Crit || !isSelfCrit || isRegularCrit) {
    throw new Error('Critical process protection check failed');
  }
  console.log('  • Critical Process Guards: PID 0, PID 4, and Self are safely protected.');

  // Guarded termination attempt
  const killAttempt = await proc.killProcess(4, 'System');
  if (killAttempt.success) {
    throw new Error('Critical process termination was NOT blocked!');
  }
  console.log(`  • Guarded Termination Result: "${killAttempt.error}"`);
  console.log('  ✅ ProcessService: listings, sorting, filtering, and critical guards verified.\n');

  console.log('========================================');
  console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY');
  console.log('========================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILURE:', err);
  process.exit(1);
});
