import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdin, useStdout } from 'ink';

interface DiagnosticScreenProps {
  onDone?: () => void;
}

export const DiagnosticScreen: React.FC<DiagnosticScreenProps> = ({ onDone }) => {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();
  const { stdout } = useStdout();

  const [mounted, setMounted] = useState(false);
  const [lastInput, setLastInput] = useState<string>('None yet (awaiting keypress)');
  const [inputCount, setInputCount] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    console.error('[DIAGNOSTIC]: Component mounted successfully at ' + new Date().toISOString());
  }, []);

  useInput(
    (input, key) => {
      setInputCount((c) => c + 1);
      const keyDesc = key.return
        ? 'Enter'
        : key.escape
        ? 'Escape'
        : key.tab
        ? 'Tab'
        : key.upArrow
        ? 'UpArrow'
        : key.downArrow
        ? 'DownArrow'
        : input || 'SpecialKey';

      setLastInput(`Key: "${keyDesc}" at ${new Date().toLocaleTimeString()}`);

      if (input.toLowerCase() === 'q' || (key.ctrl && input === 'c')) {
        if (onDone) {
          onDone();
        } else {
          exit();
        }
      }
    },
    { isActive: isRawModeSupported }
  );

  const cols = stdout?.columns ?? process.stdout.columns ?? 80;
  const rows = stdout?.rows ?? process.stdout.rows ?? 24;

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={2} paddingY={1}>
      <Box justifyContent="center" marginY={1}>
        <Text bold color="green">
          ★ BINARIE TERMINAL WORKING ★
        </Text>
      </Box>

      <Box flexDirection="column" marginY={1}>
        <Text bold color="cyan">
          ▶ Terminal Environment & TTY Diagnostics:
        </Text>
        <Text>  • process.stdin.isTTY  : <Text bold color={process.stdin.isTTY ? 'green' : 'red'}>{String(process.stdin.isTTY)}</Text></Text>
        <Text>  • process.stdout.isTTY : <Text bold color={process.stdout.isTTY ? 'green' : 'red'}>{String(process.stdout.isTTY)}</Text></Text>
        <Text>  • isRawModeSupported   : <Text bold color={isRawModeSupported ? 'green' : 'yellow'}>{String(isRawModeSupported)}</Text></Text>
        <Text>  • Terminal Dimensions  : <Text bold color="white">{cols} cols × {rows} rows</Text></Text>
        <Text>  • Node.js Version      : <Text dimColor>{process.version} ({process.platform} {process.arch})</Text></Text>
        <Text>  • Component Lifecycle  : <Text color={mounted ? 'green' : 'yellow'}>{mounted ? 'Mounted' : 'Mounting…'}</Text></Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1} marginY={1}>
        <Text bold color="yellow">
          ▶ Terminal input detected:
        </Text>
        <Text color="white">  Last Input : <Text bold color="#50fa7b">{lastInput}</Text></Text>
        <Text color="white">  Total Keys : <Text bold color="#f1fa8c">{inputCount}</Text></Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text bold color="red">
          Press Q to exit
        </Text>
        <Text dimColor>
          ttyd + React Ink Diagnostic Mode
        </Text>
      </Box>
    </Box>
  );
};

export default DiagnosticScreen;
