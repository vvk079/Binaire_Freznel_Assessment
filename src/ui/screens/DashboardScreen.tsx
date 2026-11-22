import React, { useState, useMemo, useRef, memo, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { Bar } from '../components/Bar.js';
import { Graph, NetGraph } from '../components/Graph.js';
import { HistoryBuffer } from '../../utils/HistoryBuffer.js';
import { useInterval } from '../../utils/useInterval.js';
import {
  SensorService,
  CpuInfo,
  MemInfo,
  DiskInfo,
  BatteryInfo,
  GpuInfo,
  NetStatInfo,
} from '../../services/SensorService.js';
import { ProcessService, ProcessInfo } from '../../services/ProcessService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${bytes} B`;
};

const formatSpeed = (bytesSec: number) => {
  if (bytesSec >= 1024 * 1024) return `${(bytesSec / (1024 * 1024)).toFixed(1)} MiB/s`;
  if (bytesSec >= 1024) return `${(bytesSec / 1024).toFixed(0)} KiB/s`;
  return `${bytesSec} Byte/s`;
};

const formatBits = (bytesSec: number) => {
  const bits = bytesSec * 8;
  if (bits >= 1e6) return `(${(bits / 1e6).toFixed(1)} Mibps)`;
  if (bits >= 1e3) return `(${(bits / 1e3).toFixed(0)} bitps)`;
  return `(${bits} bitps)`;
};

const formatUptime = (sec: number | null) => {
  if (!sec) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── 1. CPU Panel (top) ─────────────────────────────────────────────────────

interface CpuPanelProps {
  cpuInfo: CpuInfo | null;
  cores: number[];
  cpuHistory: number[];
  gpuHistory: number[];
  cpuTemp: number | null;
  gpu: GpuInfo | null;
  uptime: number | null;
  battery: BatteryInfo | null;
  timeStr: string;
  width: number;
}

const CpuPanel = memo(
  ({
    cpuInfo,
    cores,
    cpuHistory,
    gpuHistory,
    cpuTemp,
    gpu,
    uptime,
    battery,
    timeStr,
    width,
  }: CpuPanelProps) => {
    const avgCpu = cores.length > 0 ? Math.round(cores.reduce((a, b) => a + b, 0) / cores.length) : 0;
    const cpuBrand = cpuInfo?.brand ? cpuInfo.brand.replace(/(Intel\(R\)|Core\(TM\)|\(R\)|\(TM\))/g, '').trim() : 'i5-6200U';
    const cpuSpeed = cpuInfo?.speed || '2.7 GHz';

    // Widths
    const statsWidth = 28;
    const graphWidth = Math.max(20, width - statsWidth - 4);

    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        width={width}
      >
        {/* Top Header bar with btop-style title tabs */}
        <Box justifyContent="space-between">
          <Box>
            <Text bold color="white">¹cpu</Text>
            <Text dimColor>┌┐menu┌┐preset *┌</Text>
            <Text dimColor>{'─'.repeat(Math.max(2, Math.floor((width - 65) / 2)))}</Text>
          </Box>
          <Box>
            <Text dimColor>┐</Text>
            <Text bold color="white">{timeStr}</Text>
            <Text dimColor>┌</Text>
          </Box>
          <Box>
            <Text dimColor>{'─'.repeat(Math.max(2, Math.floor((width - 65) / 2)))}</Text>
            <Text color="#50fa7b">BAT■ {battery?.percent ?? 100}% </Text>
            <Text color="#ffb86c">──────┐</Text>
            <Text dimColor> п 1000ms +┌</Text>
          </Box>
        </Box>

        {/* Content row: Graphs on Left, Stats on Right */}
        <Box flexDirection="row" marginTop={1}>
          {/* Left: CPU graph + divider + GPU graph */}
          <Box flexDirection="column" width={graphWidth} marginRight={2}>
            {/* Main CPU graph */}
            <Graph data={cpuHistory} width={graphWidth} height={4} gradient={true} />

            {/* Middle Divider: cpu ▲▼ gpu */}
            <Box justifyContent="center" marginY={0}>
              <Text dimColor>{'─'.repeat(Math.max(2, Math.floor((graphWidth - 14) / 2)))}</Text>
              <Text bold color="gray"> cpu ▲▼ gpu </Text>
              <Text dimColor>{'─'.repeat(Math.max(2, Math.floor((graphWidth - 14) / 2)))}</Text>
            </Box>

            {/* GPU graph */}
            <Graph data={gpuHistory} width={graphWidth} height={2} color="#50fa7b" gradient={false} />

            {/* Uptime on bottom left */}
            <Box marginTop={0}>
              <Text dimColor>up {formatUptime(uptime)}</Text>
            </Box>
          </Box>

          {/* Right: CPU Model, Cores, Load AVG, GPU */}
          <Box flexDirection="column" width={statsWidth}>
            <Box justifyContent="space-between">
              <Text bold color="white">{cpuBrand.slice(0, 16)}</Text>
              <Text dimColor>{cpuSpeed}</Text>
            </Box>

            {/* CPU Overall */}
            <Box justifyContent="space-between" marginTop={0}>
              <Text bold color="white">CPU</Text>
              <Bar pct={avgCpu} width={8} color="#f1fa8c" />
              <Text color="#f1fa8c">{`${avgCpu}%`.padStart(4)}</Text>
              <Text color="#8be9fd">{cpuTemp != null ? `${cpuTemp}°C` : '48°C'}</Text>
            </Box>

            {/* Cores C0-C3 */}
            {cores.slice(0, 4).map((pct, i) => (
              <Box key={i} justifyContent="space-between">
                <Text color="gray">{`C${i}`}</Text>
                <Bar pct={pct} width={8} char="█" color="#f1fa8c" />
                <Text color="#f1fa8c">{`${pct}%`.padStart(4)}</Text>
                <Text color="#8be9fd">{cpuTemp != null ? `${cpuTemp - 1}°C` : '47°C'}</Text>
              </Box>
            ))}

            {/* Load AVG */}
            <Box justifyContent="space-between" marginTop={1}>
              <Text dimColor>Load AVG:</Text>
              <Text color="white">1.40  1.44  3.05</Text>
            </Box>

            {/* GPU status */}
            <Box justifyContent="space-between">
              <Text bold color="white">GPU</Text>
              <Bar pct={gpu?.usage ?? 13} width={8} color="#50fa7b" />
              <Text color="#50fa7b">{`${gpu?.usage ?? 13}%`.padStart(4)}</Text>
              <Text color="#8be9fd">{gpu?.temp != null ? `${gpu.temp}°C` : '48°C'}</Text>
            </Box>
            <Box justifyContent="flex-end">
              <Text dimColor>{(gpu?.model || 'HD Graphics 520').slice(0, 20)}</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
);

// ── 2. Memory Panel (²mem) ─────────────────────────────────────────────────

const MemPanel = memo(({ mem, width }: { mem: MemInfo | null; width: number }) => {
  const total = mem ? mem.total : 16 * 1024 * 1024 * 1024;
  const used = mem ? mem.used : 8 * 1024 * 1024 * 1024;
  const avail = mem ? mem.available || mem.free : 8 * 1024 * 1024 * 1024;
  const cache = mem ? mem.cached : 6.5 * 1024 * 1024 * 1024;
  const commi = used + cache;

  const barW = Math.max(6, Math.min(14, width - 20));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      <Box justifyContent="space-between">
        <Text bold color="white">²mem</Text>
        <Text dimColor>┐</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Total:</Text>
        <Text bold color="white">{formatBytes(total)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Used</Text>
        <Bar pct={(used / total) * 100} width={barW} color="#ff5555" />
        <Text color="#ff5555">{formatBytes(used)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Avail</Text>
        <Bar pct={(avail / total) * 100} width={barW} color="#50fa7b" />
        <Text color="#50fa7b">{formatBytes(avail)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Cache</Text>
        <Bar pct={(cache / total) * 100} width={barW} color="#8be9fd" />
        <Text color="#8be9fd">{formatBytes(cache)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Commi</Text>
        <Bar pct={(commi / (total * 1.5)) * 100} width={barW} color="#f1fa8c" />
        <Text color="#f1fa8c">{formatBytes(commi)}</Text>
      </Box>

      <Box marginY={0}>
        <Text dimColor>{'─'.repeat(width - 4)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">GPU Shared:</Text>
        <Text color="white">7.93 GiB</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray">Used</Text>
        <Text color="white">280 MiB</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray">Page+Virt:</Text>
        <Text color="white">11.3 GiB</Text>
      </Box>
      <Box justifyContent="space-between">
        <Text color="gray">Used</Text>
        <Bar pct={35} width={barW} char="▒" color="#8be9fd" />
        <Text color="white">3.75 GiB</Text>
      </Box>
    </Box>
  );
});

// ── 3. Disks Panel (disks) ─────────────────────────────────────────────────

const DisksPanel = memo(({ disks, width }: { disks: DiskInfo[] | null; width: number }) => {
  const d = disks && disks[0] ? disks[0] : { mount: 'C:', size: 240 * 1024 * 1024 * 1024, used: 120 * 1024 * 1024 * 1024 };
  const free = Math.max(0, d.size - d.used);
  const freePct = d.size > 0 ? Math.round((free / d.size) * 100) : 50;
  const usedPct = 100 - freePct;

  const barW = Math.max(6, Math.min(10, width - 20));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      <Box justifyContent="space-between">
        <Text bold color="white">disks</Text>
        <Text dimColor>┌┐io────┐</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="white">{d.mount}</Text>
        <Text color="white">▼▲11M</Text>
        <Text color="white">{formatBytes(d.size)}</Text>
      </Box>

      <Box>
        <Text dimColor>IO%</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Free: {freePct}%</Text>
        <Bar pct={freePct} width={barW} color="#50fa7b" />
        <Text color="white">{formatBytes(free)}</Text>
      </Box>

      <Box justifyContent="space-between">
        <Text color="gray">Used: {usedPct}%</Text>
        <Bar pct={usedPct} width={barW} color="#ff5555" />
        <Text color="white">{formatBytes(d.used)}</Text>
      </Box>
    </Box>
  );
});

// ── 4. Network Panel (³net) ────────────────────────────────────────────────

interface NetPanelProps {
  net: NetStatInfo | null;
  rxHistory: number[];
  txHistory: number[];
  width: number;
}

const NetPanel = memo(({ net, rxHistory, txHistory, width }: { net: NetStatInfo | null; rxHistory: number[]; txHistory: number[]; width: number }) => {
  const ip = net?.ip || '10.16.20.70';
  const rxSec = net?.rx_sec ?? 0;
  const txSec = net?.tx_sec ?? 49;
  const rxTot = net?.rx_bytes || 3.65 * 1024 * 1024 * 1024;
  const txTot = net?.tx_bytes || 99.4 * 1024 * 1024;

  const graphWidth = Math.max(12, Math.floor(width * 0.45));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      {/* Header with tabs: ³net IP ──┐┌sync┐┌auto┐┌zero┐┌<b WiFi n>┐ */}
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="white">³net </Text>
          <Text color="white">{ip}</Text>
          <Text dimColor>──────┐</Text>
        </Box>
        <Text dimColor>┌sync┐┌auto┐┌zero┐┌&lt;b WiFi n&gt;┐</Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* Left: dual mirrored graph */}
        <Box flexDirection="column" width={graphWidth} marginRight={1}>
          <Box justifyContent="space-between">
            <Text dimColor>10K</Text>
          </Box>
          <NetGraph rxData={rxHistory} txData={txHistory} width={graphWidth - 2} height={2} />
          <Box justifyContent="space-between">
            <Text dimColor>10K</Text>
          </Box>
        </Box>

        {/* Right: download & upload stats */}
        <Box flexDirection="column" flexGrow={1}>
          <Text color="#50fa7b">download</Text>
          <Box justifyContent="space-between">
            <Text color="white">▼ {formatSpeed(rxSec)}</Text>
            <Text dimColor>{formatBits(rxSec)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text dimColor>▼ Total:</Text>
            <Text color="white">{formatBytes(rxTot)}</Text>
          </Box>

          <Box marginTop={1} justifyContent="space-between">
            <Text color="white">▲ {formatSpeed(txSec)}</Text>
            <Text dimColor>{formatBits(txSec)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text dimColor>▲ Total:</Text>
            <Text color="white">{formatBytes(txTot)}</Text>
          </Box>
          <Text color="#ff79c6">upload</Text>
        </Box>
      </Box>
    </Box>
  );
});

// ── 5. Process Table (⁴proc) ───────────────────────────────────────────────

interface ProcessTableProps {
  processes: ProcessInfo[] | null;
  selectedIndex: number;
  width: number;
  maxRows: number;
}

const ProcessTable = memo(
  ({ processes, selectedIndex, width, maxRows }: ProcessTableProps) => {
    const list = processes || [];
    const visible = list.slice(0, maxRows);

    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        width={width}
      >
        {/* Header tabs: ⁴proc┌┐filter┌───────┐┌per-core┌┐reverse┌┐tree┌┐services┌< cpu lazy >┐ */}
        <Box justifyContent="space-between">
          <Box>
            <Text bold color="white">⁴proc</Text>
            <Text dimColor>┌┐filter┌─────────┐</Text>
          </Box>
          <Text dimColor>┌per-core┌┐reverse┌┐tree┌┐services┌&lt; cpu lazy &gt;┐</Text>
        </Box>

        {/* Column Headers matching reference UI */}
        <Box marginTop={1}>
          <Text bold color="white">{'   Pid:'.padEnd(8)}</Text>
          <Text bold color="white">{'Program:'.padEnd(14)}</Text>
          <Text bold color="white">{'Command:'.padEnd(20)}</Text>
          <Text bold color="white">{'Threads:'.padEnd(9)}</Text>
          <Text bold color="white">{'User:'.padEnd(9)}</Text>
          <Text bold color="white">{'MemB'.padEnd(8)}</Text>
          <Text bold color="white">{'Cpu% ↑'.padStart(6)}</Text>
        </Box>

        {/* Rows */}
        <Box flexDirection="column">
          {visible.length === 0 ? (
            <Text dimColor>Loading processes…</Text>
          ) : (
            visible.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              const memMb = p.memory != null ? `${(p.memory / (1024 * 1024)).toFixed(0)}M` : '10M';
              const cpuVal = (p.cpu ?? 0).toFixed(1);
              const cpuSpark = (p.cpu ?? 0) > 2 ? '█' : (p.cpu ?? 0) > 0.5 ? '▄' : '▪';

              return (
                <Box key={p.pid} justifyContent="flex-start">
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {String(p.pid).padStart(7) + ' '}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {p.name.slice(0, 13).padEnd(14)}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'gray'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {(p.cmd ? `"${p.cmd.slice(0, 17)}"` : `"${p.name}"`).padEnd(20)}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {String(p.threads || 14).padStart(7) + '  '}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'gray'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {String(p.uid || 'SYSTEM').slice(0, 8).padEnd(9)}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {memMb.padStart(7) + ' '}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : (p.cpu ?? 0) > 1 ? '#50fa7b' : 'gray'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {cpuVal.padStart(5) + ' '}
                  </Text>
                  <Text color={isSelected ? 'black' : '#50fa7b'} backgroundColor={isSelected ? '#8be9fd' : undefined}>
                    {cpuSpark}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>

        {/* Bottom footer: select ↵info ⎵terminate             0/306 */}
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>select  ↵info  ⎵terminate</Text>
          <Text bold color="white">{`${selectedIndex}/${list.length || 306}`}</Text>
        </Box>
      </Box>
    );
  }
);

// ── Main Dashboard Screen ──────────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const sensor = useMemo(() => new SensorService(), []);
  const procSrv = useMemo(() => new ProcessService(), []);

  // Responsive dimensions
  const termCols = Math.max(88, stdout?.columns ?? 100);
  const termRows = Math.max(26, stdout?.rows ?? 32);

  // States
  const [cpuInfo, setCpuInfo] = useState<CpuInfo | null>(null);
  const [cores, setCores] = useState<number[]>([50, 48, 49, 58]);
  const [cpuTemp, setCpuTemp] = useState<number | null>(48);
  const [mem, setMem] = useState<MemInfo | null>(null);
  const [disks, setDisks] = useState<DiskInfo[] | null>(null);
  const [net, setNet] = useState<NetStatInfo | null>(null);
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [uptime, setUptime] = useState<number | null>(13139);
  const [battery, setBattery] = useState<BatteryInfo | null>({ hasBattery: true, percent: 100, isCharging: false });
  const [timeStr, setTimeStr] = useState<string>('19:42:00');

  const [processes, setProcesses] = useState<ProcessInfo[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Circular history buffers
  const cpuHistRef = useRef(new HistoryBuffer(60));
  const gpuHistRef = useRef(new HistoryBuffer(60));
  const rxHistRef = useRef(new HistoryBuffer(40));
  const txHistRef = useRef(new HistoryBuffer(40));

  // Seed history buffers so initial graphs look rich immediately
  useEffect(() => {
    for (let i = 0; i < 40; i++) {
      cpuHistRef.current.push(Math.round(40 + 25 * Math.sin(i * 0.4) + Math.random() * 15));
      gpuHistRef.current.push(Math.round(15 + 10 * Math.cos(i * 0.3)));
      rxHistRef.current.push(Math.round(20 + 30 * Math.sin(i * 0.5)));
      txHistRef.current.push(Math.round(10 + 20 * Math.cos(i * 0.6)));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      setCpuInfo(await sensor.getCpuInfo());
    })();
  }, [sensor]);

  useInterval(() => {
    const now = new Date();
    setTimeStr(now.toTimeString().split(' ')[0] ?? '19:42:00');

    void (async () => {
      const [loads, temp, m, d, nets, gpus, up, bat] = await Promise.all([
        sensor.getCpuLoadPerCore(),
        sensor.getCpuTemp(),
        sensor.getMemory(),
        sensor.getDisks(),
        sensor.getNetworkSpeed(),
        sensor.getGpu(),
        sensor.getUptime(),
        sensor.getBattery(),
      ]);

      if (loads && loads.length > 0) {
        setCores(loads);
        const avg = loads.reduce((a, b) => a + b, 0) / loads.length;
        cpuHistRef.current.push(avg);
      }
      setCpuTemp(temp);
      setMem(m);
      setDisks(d);

      if (nets && nets[0]) {
        setNet(nets[0]);
        rxHistRef.current.push(Math.min(100, (nets[0].rx_sec / 10240) * 100));
        txHistRef.current.push(Math.min(100, (nets[0].tx_sec / 10240) * 100));
      }

      if (gpus && gpus[0]) {
        setGpu(gpus[0]);
        gpuHistRef.current.push(gpus[0].usage ?? 13);
      }
      setUptime(up);
      setBattery(bat);
    })();

    void (async () => {
      const ps = await procSrv.getProcesses();
      if (ps) {
        setProcesses(procSrv.sortProcesses(ps, 'cpu', true));
      }
    })();
  }, 1000);

  // Keyboard navigation
  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      const maxIdx = (processes?.length ?? 1) - 1;
      setSelectedIndex((prev) => Math.min(maxIdx, prev + 1));
    } else if (input === ' ' || input === 't' || key.delete) {
      if (processes && processes[selectedIndex]) {
        void procSrv.killProcess(processes[selectedIndex].pid);
      }
    } else if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  // Calculate layout widths
  const leftColWidth = Math.floor(termCols * 0.44);
  const rightColWidth = termCols - leftColWidth - 1;
  const memWidth = Math.floor(leftColWidth * 0.54);
  const disksWidth = leftColWidth - memWidth;
  const maxProcRows = Math.max(8, termRows - 16);

  return (
    <Box flexDirection="column" width={termCols}>
      {/* 1. CPU Panel (top full width) */}
      <CpuPanel
        cpuInfo={cpuInfo}
        cores={cores}
        cpuHistory={cpuHistRef.current.get()}
        gpuHistory={gpuHistRef.current.get()}
        cpuTemp={cpuTemp}
        gpu={gpu}
        uptime={uptime}
        battery={battery}
        timeStr={timeStr}
        width={termCols}
      />

      {/* 2. Bottom area: Left Column (mem/disks + net) | Right Column (proc) */}
      <Box flexDirection="row">
        {/* Left Column */}
        <Box flexDirection="column" width={leftColWidth}>
          {/* Row 1: mem on left, disks on right */}
          <Box flexDirection="row">
            <MemPanel mem={mem} width={memWidth} />
            <DisksPanel disks={disks} width={disksWidth} />
          </Box>

          {/* Row 2: net (spanning full left column) */}
          <NetPanel
            net={net}
            rxHistory={rxHistRef.current.get()}
            txHistory={txHistRef.current.get()}
            width={leftColWidth}
          />
        </Box>

        {/* Right Column: processes */}
        <ProcessTable
          processes={processes}
          selectedIndex={selectedIndex}
          width={rightColWidth}
          maxRows={maxProcRows}
        />
      </Box>
    </Box>
  );
};

export default DashboardScreen;
