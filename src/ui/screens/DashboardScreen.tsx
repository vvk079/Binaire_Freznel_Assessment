import React, { useState, useMemo, useRef, memo, useEffect, useCallback } from 'react';
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
import { ProcessService, ProcessInfo, ProcessSortKey } from '../../services/ProcessService.js';

// ── Helpers ────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number) => {
  if (isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GiB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${Math.round(bytes)} B`;
};

const formatSpeed = (bytesSec: number) => {
  if (isNaN(bytesSec) || bytesSec <= 0) return '0 B/s';
  if (bytesSec >= 1024 * 1024) return `${(bytesSec / (1024 * 1024)).toFixed(1)} MiB/s`;
  if (bytesSec >= 1024) return `${(bytesSec / 1024).toFixed(0)} KiB/s`;
  return `${Math.round(bytesSec)} B/s`;
};

const formatUptime = (sec: number | null) => {
  if (!sec || isNaN(sec)) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── 1. CPU Panel ───────────────────────────────────────────────────────────

interface CpuPanelProps {
  cpuInfo: CpuInfo | null;
  cores: number[];
  cpuHistory: number[];
  gpuHistory: number[];
  cpuTemp: number | null;
  loadAvg: { avg1: number | null; avg5: number | null; avg15: number | null };
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
    loadAvg,
    gpu,
    uptime,
    battery,
    timeStr,
    width,
  }: CpuPanelProps) => {
    const avgCpu = cores.length > 0 ? Math.round(cores.reduce((a, b) => a + b, 0) / cores.length) : 0;
    const cpuBrand = cpuInfo?.brand ? cpuInfo.brand.replace(/(Intel\(R\)|Core\(TM\)|\(R\)|\(TM\))/g, '').trim() : 'Processor';
    const cpuSpeed = cpuInfo?.speed || '';

    // Calculate sub-widths dynamically
    const statsWidth = Math.min(32, Math.max(24, Math.floor(width * 0.35)));
    const graphWidth = Math.max(16, width - statsWidth - 4);

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
            <Text dimColor>{'─'.repeat(Math.max(1, Math.floor((width - 55) / 2)))}</Text>
          </Box>
          <Box>
            <Text dimColor>┐</Text>
            <Text bold color="white">{timeStr}</Text>
            <Text dimColor>┌</Text>
          </Box>
          <Box>
            <Text dimColor>{'─'.repeat(Math.max(1, Math.floor((width - 55) / 2)))}</Text>
            {battery?.hasBattery && battery.percent !== null ? (
              <Text color="#50fa7b">BAT■ {battery.percent}% {battery.isCharging ? '⚡' : ''} </Text>
            ) : (
              <Text dimColor>AC PWR </Text>
            )}
            <Text dimColor>1000ms</Text>
          </Box>
        </Box>

        {/* Content row: Graphs on Left, Stats on Right */}
        <Box flexDirection="row" marginTop={1}>
          {/* Left: CPU graph + divider + GPU graph */}
          <Box flexDirection="column" width={graphWidth} marginRight={1}>
            <Graph data={cpuHistory} width={graphWidth} height={4} gradient={true} />

            {/* Divider: cpu ▲▼ gpu */}
            <Box justifyContent="center" marginY={0}>
              <Text dimColor>{'─'.repeat(Math.max(1, Math.floor((graphWidth - 14) / 2)))}</Text>
              <Text bold color="gray"> cpu ▲▼ gpu </Text>
              <Text dimColor>{'─'.repeat(Math.max(1, Math.floor((graphWidth - 14) / 2)))}</Text>
            </Box>

            {/* GPU graph */}
            <Graph
              data={gpuHistory}
              width={graphWidth}
              height={2}
              color={gpu?.usage !== null ? '#50fa7b' : 'gray'}
              gradient={false}
            />

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
              <Bar pct={avgCpu} width={Math.max(4, statsWidth - 16)} color="#f1fa8c" />
              <Text color="#f1fa8c">{`${avgCpu}%`.padStart(4)}</Text>
              <Text color="#8be9fd">{cpuTemp !== null ? `${cpuTemp}°C` : 'N/A'}</Text>
            </Box>

            {/* Per-core meters */}
            {cores.length > 0 ? (
              cores.slice(0, 4).map((pct, i) => (
                <Box key={i} justifyContent="space-between">
                  <Text color="gray">{`C${i}`}</Text>
                  <Bar pct={pct} width={Math.max(4, statsWidth - 16)} char="█" color="#f1fa8c" />
                  <Text color="#f1fa8c">{`${pct}%`.padStart(4)}</Text>
                  <Text color="#8be9fd">{cpuTemp !== null ? `${cpuTemp}°C` : 'N/A'}</Text>
                </Box>
              ))
            ) : (
              <Text dimColor>Reading cores…</Text>
            )}

            {/* Load AVG (UNIX run queue load averages; unsupported on Windows kernel) */}
            <Box justifyContent="space-between" marginTop={0}>
              <Text dimColor>Load AVG:</Text>
              <Text color="white">
                {loadAvg.avg1 !== null
                  ? `${loadAvg.avg1.toFixed(2)}  ${loadAvg.avg5 !== null ? loadAvg.avg5.toFixed(2) : ''}  ${loadAvg.avg15 !== null ? loadAvg.avg15.toFixed(2) : ''}`.trim()
                  : 'N/A (Windows)'}
              </Text>
            </Box>

            {/* GPU status */}
            <Box justifyContent="space-between" marginTop={0}>
              <Text bold color="white">GPU</Text>
              {gpu ? (
                <>
                  <Bar
                    pct={gpu.usage ?? 0}
                    width={Math.max(4, statsWidth - 16)}
                    color={gpu.usage !== null ? '#50fa7b' : 'gray'}
                  />
                  <Text color="#50fa7b">{gpu.usage !== null ? `${gpu.usage}%`.padStart(4) : 'N/A'}</Text>
                  <Text color="#8be9fd">{gpu.temp !== null ? `${gpu.temp}°C` : 'N/A'}</Text>
                </>
              ) : (
                <Text dimColor>Unsupported/None</Text>
              )}
            </Box>
            {gpu && (
              <Box justifyContent="flex-end">
                <Text dimColor>{gpu.model.slice(0, statsWidth - 2)}</Text>
              </Box>
            )}
          </Box>
        </Box>
      </Box>
    );
  }
);

// ── 2. Memory Panel ────────────────────────────────────────────────────────

const MemPanel = memo(({ mem, width }: { mem: MemInfo | null; width: number }) => {
  const total = mem ? mem.total : 0;
  const used = mem ? mem.used : 0;
  const avail = mem ? mem.available : 0;
  const cache = mem ? mem.cached : 0;
  const swapTot = mem ? mem.swaptotal : 0;
  const swapUsed = mem ? mem.swapused : 0;

  const barW = Math.max(4, Math.min(12, width - 20));

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

      {mem ? (
        <>
          <Box justifyContent="space-between">
            <Text color="gray">Total:</Text>
            <Text bold color="white">{formatBytes(total)}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color="gray">Used</Text>
            <Bar pct={total > 0 ? (used / total) * 100 : 0} width={barW} color="#ff5555" />
            <Text color="#ff5555">{formatBytes(used)}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color="gray">Avail</Text>
            <Bar pct={total > 0 ? (avail / total) * 100 : 0} width={barW} color="#50fa7b" />
            <Text color="#50fa7b">{formatBytes(avail)}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color="gray">Cache</Text>
            <Bar pct={total > 0 ? (cache / total) * 100 : 0} width={barW} color="#8be9fd" />
            <Text color="#8be9fd">{cache > 0 ? formatBytes(cache) : '0 B'}</Text>
          </Box>

          <Box marginY={0}>
            <Text dimColor>{'─'.repeat(Math.max(2, width - 4))}</Text>
          </Box>

          <Box justifyContent="space-between">
            <Text color="gray">Swap Total:</Text>
            <Text color="white">{swapTot > 0 ? formatBytes(swapTot) : '0 B'}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text color="gray">Swap Used</Text>
            <Bar pct={swapTot > 0 ? (swapUsed / swapTot) * 100 : 0} width={barW} char="▒" color="#8be9fd" />
            <Text color="white">{swapUsed > 0 ? formatBytes(swapUsed) : '0 B'}</Text>
          </Box>
        </>
      ) : (
        <Text dimColor>Reading memory…</Text>
      )}
    </Box>
  );
});

// ── 3. Disks Panel ─────────────────────────────────────────────────────────

const DisksPanel = memo(({ disks, width }: { disks: DiskInfo[] | null; width: number }) => {
  const d = disks && disks[0] ? disks[0] : null;
  const free = d ? Math.max(0, d.size - d.used) : 0;
  const freePct = d && d.size > 0 ? Math.round((free / d.size) * 100) : 0;
  const usedPct = d && d.size > 0 ? Math.round((d.used / d.size) * 100) : 0;

  const barW = Math.max(4, Math.min(10, width - 20));

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

      {d ? (
        <>
          <Box justifyContent="space-between">
            <Text color="white">{d.mount.slice(0, 10)}</Text>
            <Text color="white">{formatBytes(d.size)}</Text>
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
        </>
      ) : (
        <Text dimColor>No disks detected</Text>
      )}
    </Box>
  );
});

// ── 4. Network Panel ───────────────────────────────────────────────────────

interface NetPanelProps {
  net: NetStatInfo | null;
  rxHistory: number[];
  txHistory: number[];
  width: number;
}

const NetPanel = memo(({ net, rxHistory, txHistory, width }: NetPanelProps) => {
  const ip = net?.ip || 'N/A';
  const rxSec = net?.rx_sec ?? 0;
  const txSec = net?.tx_sec ?? 0;
  const rxTot = net?.rx_bytes ?? 0;
  const txTot = net?.tx_bytes ?? 0;

  const graphWidth = Math.max(10, Math.floor(width * 0.45));

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      width={width}
    >
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="white">³net </Text>
          <Text color="white">{ip}</Text>
          <Text dimColor>──┐</Text>
        </Box>
        <Text dimColor>┌&lt;{net?.iface || 'eth0'}&gt;┐</Text>
      </Box>

      <Box flexDirection="row" marginTop={1}>
        {/* Left: dual mirrored graph */}
        <Box flexDirection="column" width={graphWidth} marginRight={1}>
          <Box justifyContent="space-between">
            <Text dimColor>RX</Text>
          </Box>
          <NetGraph rxData={rxHistory} txData={txHistory} width={graphWidth - 2} height={2} />
          <Box justifyContent="space-between">
            <Text dimColor>TX</Text>
          </Box>
        </Box>

        {/* Right: transfer rates */}
        <Box flexDirection="column" flexGrow={1}>
          <Text color="#50fa7b">download</Text>
          <Box justifyContent="space-between">
            <Text color="white">▼ {formatSpeed(rxSec)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text dimColor>Total:</Text>
            <Text color="white">{formatBytes(rxTot)}</Text>
          </Box>

          <Box marginTop={1} justifyContent="space-between">
            <Text color="#ff79c6">▲ {formatSpeed(txSec)}</Text>
          </Box>
          <Box justifyContent="space-between">
            <Text dimColor>Total:</Text>
            <Text color="white">{formatBytes(txTot)}</Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
});

// ── 5. Process Table ───────────────────────────────────────────────────────

interface ProcessTableProps {
  processes: ProcessInfo[] | null;
  selectedIndex: number;
  sortBy: ProcessSortKey;
  sortDesc: boolean;
  filterText: string;
  isFiltering: boolean;
  width: number;
  maxRows: number;
  compact: boolean;
}

const ProcessTable = memo(
  ({
    processes,
    selectedIndex,
    sortBy,
    sortDesc,
    filterText,
    isFiltering,
    width,
    maxRows,
    compact,
  }: ProcessTableProps) => {
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
        {/* Header tabs with active sort and filter info */}
        <Box justifyContent="space-between">
          <Box>
            <Text bold color="white">⁴proc </Text>
            {isFiltering ? (
              <Text color="#50fa7b">🔍 Filter: {filterText}_</Text>
            ) : filterText ? (
              <Text color="#8be9fd">[{filterText}] </Text>
            ) : (
              <Text dimColor>┌┐filter [f]┌ </Text>
            )}
          </Box>
          <Text color="#8be9fd">
            {sortBy.toUpperCase()} {sortDesc ? '▼' : '▲'} [s]
          </Text>
        </Box>

        {/* Column Headers */}
        <Box marginTop={1}>
          <Text bold color="white">{' PID'.padEnd(7)}</Text>
          <Text bold color="white">{'PROGRAM'.padEnd(compact ? 12 : 16)}</Text>
          {!compact && <Text bold color="white">{'COMMAND'.padEnd(16)}</Text>}
          {!compact && <Text bold color="white">{'THR'.padEnd(5)}</Text>}
          {!compact && <Text bold color="white">{'USER'.padEnd(9)}</Text>}
          <Text bold color="white">{'MEM'.padEnd(8)}</Text>
          <Text bold color="white">{'CPU%'.padStart(5)}</Text>
        </Box>

        {/* Process rows */}
        <Box flexDirection="column">
          {visible.length === 0 ? (
            <Text dimColor> {processes === null ? 'Scanning processes…' : 'No processes matching filter'}</Text>
          ) : (
            visible.map((p, idx) => {
              const isSelected = idx === selectedIndex;
              const memMb = p.memory > 0 ? `${(p.memory / (1024 * 1024)).toFixed(0)}M` : '0M';
              const cpuVal = p.cpu.toFixed(1);
              const cpuColor = p.cpu > 60 ? '#ff5555' : p.cpu > 20 ? '#f1fa8c' : '#50fa7b';

              return (
                <Box key={p.pid} justifyContent="flex-start">
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {String(p.pid).padStart(6) + ' '}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {p.name.slice(0, compact ? 11 : 15).padEnd(compact ? 12 : 16)}
                  </Text>
                  {!compact && (
                    <Text
                      color={isSelected ? 'black' : 'gray'}
                      backgroundColor={isSelected ? '#8be9fd' : undefined}
                    >
                      {p.cmd.slice(0, 15).padEnd(16)}
                    </Text>
                  )}
                  {!compact && (
                    <Text
                      color={isSelected ? 'black' : 'gray'}
                      backgroundColor={isSelected ? '#8be9fd' : undefined}
                    >
                      {String(p.threads).padStart(4) + ' '}
                    </Text>
                  )}
                  {!compact && (
                    <Text
                      color={isSelected ? 'black' : 'gray'}
                      backgroundColor={isSelected ? '#8be9fd' : undefined}
                    >
                      {p.uid.slice(0, 8).padEnd(9)}
                    </Text>
                  )}
                  <Text
                    color={isSelected ? 'black' : 'white'}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {memMb.padStart(6) + '  '}
                  </Text>
                  <Text
                    color={isSelected ? 'black' : cpuColor}
                    backgroundColor={isSelected ? '#8be9fd' : undefined}
                  >
                    {cpuVal.padStart(5)}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>

        {/* Footer */}
        <Box marginTop={1} justifyContent="space-between">
          <Text dimColor>[↵] Info  [t/Del] Kill</Text>
          <Text bold color="white">
            {list.length > 0 ? `${selectedIndex + 1}/${list.length}` : '0/0'}
          </Text>
        </Box>
      </Box>
    );
  }
);

// ── Modals & Dialogs ───────────────────────────────────────────────────────

const ConfirmationModal = memo(
  ({
    target,
    onConfirm,
    onCancel,
    width,
  }: {
    target: ProcessInfo;
    onConfirm: () => void;
    onCancel: () => void;
    width: number;
  }) => (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="#ff5555"
      paddingX={2}
      paddingY={1}
      width={Math.min(54, width - 4)}
    >
      <Text bold color="#ff5555">⚠️ Confirm Process Termination</Text>
      <Box marginTop={1}>
        <Text>Terminate PID {target.pid} ({target.name})?</Text>
      </Box>
      <Text dimColor>Warning: Unsaved data inside this process may be lost.</Text>
      <Box marginTop={1} justifyContent="space-between">
        <Text color="#50fa7b">[y / Enter] Confirm Kill</Text>
        <Text color="#f1fa8c">[n / Esc] Cancel</Text>
      </Box>
    </Box>
  )
);

const ProcessDetailModal = memo(
  ({
    target,
    onClose,
    width,
  }: {
    target: ProcessInfo;
    onClose: () => void;
    width: number;
  }) => (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="#8be9fd"
      paddingX={2}
      paddingY={1}
      width={Math.min(60, width - 4)}
    >
      <Text bold color="#8be9fd">📋 Process Inspection (PID {target.pid})</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>Program Name : <Text color="white" bold>{target.name}</Text></Text>
        <Text>Command Line : <Text dimColor>{target.cmd || 'N/A'}</Text></Text>
        <Text>Process Owner: <Text color="white">{target.uid}</Text></Text>
        <Text>Threads Count: <Text color="white">{target.threads}</Text></Text>
        <Text>Memory Usage : <Text color="#50fa7b">{formatBytes(target.memory)}</Text></Text>
        <Text>CPU Load     : <Text color="#f1fa8c">{target.cpu.toFixed(1)}%</Text></Text>
      </Box>
      <Box marginTop={1} justifyContent="flex-end">
        <Text dimColor>Press [Esc / Enter] to close</Text>
      </Box>
    </Box>
  )
);

// ── Main Dashboard Screen ──────────────────────────────────────────────────

const DashboardScreen: React.FC = () => {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const sensor = useMemo(() => new SensorService(), []);
  const procSrv = useMemo(() => new ProcessService(), []);

  // 1. Dynamic Terminal Dimensions with Resize Listener
  const [dimensions, setDimensions] = useState({
    columns: stdout?.columns ?? 90,
    rows: stdout?.rows ?? 28,
  });

  useEffect(() => {
    const handleResize = () => {
      if (stdout) {
        setDimensions({
          columns: stdout.columns ?? 90,
          rows: stdout.rows ?? 28,
        });
      }
    };
    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  const { columns: termCols, rows: termRows } = dimensions;

  // 2. States for Sensor Data
  const [cpuInfo, setCpuInfo] = useState<CpuInfo | null>(null);
  const [cores, setCores] = useState<number[]>([]);
  const [cpuTemp, setCpuTemp] = useState<number | null>(null);
  const [loadAvg, setLoadAvg] = useState<{ avg1: number | null; avg5: number | null; avg15: number | null }>({
    avg1: null,
    avg5: null,
    avg15: null,
  });
  const [mem, setMem] = useState<MemInfo | null>(null);
  const [disks, setDisks] = useState<DiskInfo[] | null>(null);
  const [net, setNet] = useState<NetStatInfo | null>(null);
  const [gpu, setGpu] = useState<GpuInfo | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);
  const [battery, setBattery] = useState<BatteryInfo | null>(null);
  const [timeStr, setTimeStr] = useState<string>('');

  // 3. States for Process List and Interactivity
  const [rawProcesses, setRawProcesses] = useState<ProcessInfo[] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<ProcessSortKey>('cpu');
  const [sortDesc, setSortDesc] = useState<boolean>(true);
  const [filterText, setFilterText] = useState<string>('');
  const [isFiltering, setIsFiltering] = useState<boolean>(false);

  // Modal / Interaction States
  const [killTarget, setKillTarget] = useState<ProcessInfo | null>(null);
  const [detailTarget, setDetailTarget] = useState<ProcessInfo | null>(null);
  const [alertMessage, setAlertMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Circular History Buffers
  const cpuHistRef = useRef(new HistoryBuffer(60));
  const gpuHistRef = useRef(new HistoryBuffer(60));
  const rxHistRef = useRef(new HistoryBuffer(40));
  const txHistRef = useRef(new HistoryBuffer(40));

  // Initial metadata fetch
  useEffect(() => {
    void (async () => {
      setCpuInfo(await sensor.getCpuInfo());
    })();
  }, [sensor]);

  // Periodic sensor & process refresh (every 1s)
  useInterval(() => {
    const now = new Date();
    setTimeStr(now.toTimeString().split(' ')[0] ?? '');

    // Sensor telemetry update
    void (async () => {
      const [loads, temp, loadsAverages, m, d, nets, gpus, up, bat] = await Promise.all([
        sensor.getCpuLoadPerCore(),
        sensor.getCpuTemp(),
        sensor.getLoadAverages(),
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
      setLoadAvg(loadsAverages);
      setMem(m);
      setDisks(d);

      if (nets && nets[0]) {
        setNet(nets[0]);
        rxHistRef.current.push(Math.min(100, (nets[0].rx_sec / 10240) * 100));
        txHistRef.current.push(Math.min(100, (nets[0].tx_sec / 10240) * 100));
      }

      if (gpus && gpus[0]) {
        setGpu(gpus[0]);
        if (gpus[0].usage !== null) {
          gpuHistRef.current.push(gpus[0].usage);
        }
      }
      setUptime(up);
      setBattery(bat);
    })();

    // Process telemetry update
    void (async () => {
      const ps = await procSrv.getProcesses();
      if (ps) {
        setRawProcesses(ps);
      }
    })();
  }, 1000);

  // Filter and sort process list
  const processedList = useMemo(() => {
    if (!rawProcesses) return null;
    let list = rawProcesses;

    if (filterText.trim()) {
      list = procSrv.filterProcesses(list, filterText);
    }
    return procSrv.sortProcesses(list, sortBy, sortDesc);
  }, [rawProcesses, filterText, sortBy, sortDesc, procSrv]);

  // Safe process termination executor
  const handleConfirmKill = useCallback(async () => {
    if (!killTarget) return;
    const target = killTarget;
    setKillTarget(null);

    setAlertMessage({ text: `Terminating PID ${target.pid} (${target.name})…`, isError: false });
    const result = await procSrv.killProcess(target.pid, target.name);

    if (result.success) {
      setAlertMessage({ text: `✅ Successfully terminated PID ${target.pid}`, isError: false });
    } else {
      setAlertMessage({ text: `❌ ${result.error || 'Failed to terminate process'}`, isError: true });
    }

    setTimeout(() => setAlertMessage(null), 4000);
  }, [killTarget, procSrv]);

  // Keyboard navigation & interaction controller
  useInput((input, key) => {
    // 1. Confirmation Modal Active
    if (killTarget) {
      if (input === 'y' || key.return) {
        void handleConfirmKill();
      } else if (input === 'n' || key.escape) {
        setKillTarget(null);
      }
      return;
    }

    // 2. Process Details Modal Active
    if (detailTarget) {
      if (key.escape || key.return) {
        setDetailTarget(null);
      }
      return;
    }

    // 3. Search / Filter Input Mode Active
    if (isFiltering) {
      if (key.return || key.escape) {
        setIsFiltering(false);
      } else if (key.backspace || key.delete) {
        setFilterText((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
      } else if (input && input.length === 1) {
        setFilterText((prev) => prev + input);
        setSelectedIndex(0);
      }
      return;
    }

    // 4. Normal Navigation Mode
    const listCount = processedList?.length ?? 0;

    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(Math.max(0, listCount - 1), prev + 1));
    } else if (key.pageUp) {
      setSelectedIndex((prev) => Math.max(0, prev - 5));
    } else if (key.pageDown) {
      setSelectedIndex((prev) => Math.min(Math.max(0, listCount - 1), prev + 5));
    } else if (key.return) {
      // Open process details inspection
      if (processedList && processedList[selectedIndex]) {
        setDetailTarget(processedList[selectedIndex]!);
      }
    } else if (input === ' ' || input === 't' || key.delete) {
      // Open kill confirmation modal
      if (processedList && processedList[selectedIndex]) {
        const p = processedList[selectedIndex]!;
        if (procSrv.isCriticalProcess(p.pid, p.name)) {
          setAlertMessage({
            text: `⚠️ Cannot terminate protected system process: PID ${p.pid} (${p.name})`,
            isError: true,
          });
          setTimeout(() => setAlertMessage(null), 3000);
        } else {
          setKillTarget(p);
        }
      }
    } else if (input === 'f' || input === '/') {
      setIsFiltering(true);
    } else if (input === 'c' && filterText) {
      setFilterText('');
      setSelectedIndex(0);
    } else if (input === 's') {
      // Cycle sorting keys
      const keys: ProcessSortKey[] = ['cpu', 'memory', 'pid', 'name', 'threads'];
      const nextIdx = (keys.indexOf(sortBy) + 1) % keys.length;
      setSortBy(keys[nextIdx]!);
      setSelectedIndex(0);
    } else if (input === 'r') {
      setSortDesc((prev) => !prev);
      setSelectedIndex(0);
    } else if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  // Responsive Layout Guards: If terminal is too small, render graceful warning
  if (termCols < 60 || termRows < 16) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        paddingY={1}
        width={termCols - 2}
      >
        <Text bold color="yellow">⚠️ Terminal Window Too Small</Text>
        <Text>Current size: {termCols} cols × {termRows} rows</Text>
        <Text>Minimum required: 60 cols × 16 rows</Text>
        <Box marginTop={1}>
          <Text dimColor>Please expand your terminal window to display the monitor.</Text>
        </Box>
      </Box>
    );
  }

  // Calculate proportional column widths
  const isCompact = termCols < 100;
  const leftColWidth = Math.max(30, Math.floor(termCols * (isCompact ? 0.42 : 0.44)));
  const rightColWidth = Math.max(30, termCols - leftColWidth - 1);
  const memWidth = isCompact ? leftColWidth : Math.floor(leftColWidth * 0.54);
  const disksWidth = isCompact ? leftColWidth : leftColWidth - memWidth;
  const maxProcRows = Math.max(6, termRows - 16);

  return (
    <Box flexDirection="column" width={termCols}>
      {/* 1. CPU Panel (top full width) */}
      <CpuPanel
        cpuInfo={cpuInfo}
        cores={cores}
        cpuHistory={cpuHistRef.current.get()}
        gpuHistory={gpuHistRef.current.get()}
        cpuTemp={cpuTemp}
        loadAvg={loadAvg}
        gpu={gpu}
        uptime={uptime}
        battery={battery}
        timeStr={timeStr}
        width={termCols}
      />

      {/* Alert Banner (if process action performed) */}
      {alertMessage && (
        <Box paddingX={1} marginY={0}>
          <Text bold color={alertMessage.isError ? '#ff5555' : '#50fa7b'}>
            {alertMessage.text}
          </Text>
        </Box>
      )}

      {/* Modal Overlays */}
      {killTarget && (
        <Box justifyContent="center" marginY={1}>
          <ConfirmationModal
            target={killTarget}
            onConfirm={handleConfirmKill}
            onCancel={() => setKillTarget(null)}
            width={termCols}
          />
        </Box>
      )}

      {detailTarget && (
        <Box justifyContent="center" marginY={1}>
          <ProcessDetailModal
            target={detailTarget}
            onClose={() => setDetailTarget(null)}
            width={termCols}
          />
        </Box>
      )}

      {/* 2. Bottom Area: Left Metrics Column | Right Process Table */}
      {!killTarget && !detailTarget && (
        <Box flexDirection="row">
          {/* Left Metrics Column */}
          <Box flexDirection="column" width={leftColWidth}>
            {isCompact ? (
              <>
                <MemPanel mem={mem} width={leftColWidth} />
                <DisksPanel disks={disks} width={leftColWidth} />
              </>
            ) : (
              <Box flexDirection="row">
                <MemPanel mem={mem} width={memWidth} />
                <DisksPanel disks={disks} width={disksWidth} />
              </Box>
            )}

            <NetPanel
              net={net}
              rxHistory={rxHistRef.current.get()}
              txHistory={txHistRef.current.get()}
              width={leftColWidth}
            />
          </Box>

          {/* Right Process Table */}
          <ProcessTable
            processes={processedList}
            selectedIndex={selectedIndex}
            sortBy={sortBy}
            sortDesc={sortDesc}
            filterText={filterText}
            isFiltering={isFiltering}
            width={rightColWidth}
            maxRows={maxProcRows}
            compact={isCompact}
          />
        </Box>
      )}

      {/* Persistent Keyboard Shortcuts Help Bar */}
      <Box paddingX={1} justifyContent="space-between">
        <Text dimColor>
          [↑↓] Select  [↵] Details  [t/Del] Kill  [s] Sort  [r] Reverse  [f] Filter  [q] Quit
        </Text>
      </Box>
    </Box>
  );
};

export default DashboardScreen;
