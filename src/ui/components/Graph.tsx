import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

interface GraphProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  gradient?: boolean;
}

const BLOCKS = [' ', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * btop-style multi-tiered shaded block graph.
 * Supports braille/block levels with gradient:
 * Base: green, Mid: yellow/gold, Peak: peach/red, with shaded dithering at the peaks.
 */
export const Graph: React.FC<GraphProps> = ({
  data,
  width = 50,
  height = 5,
  color,
  gradient = true,
}) => {
  const rows = useMemo(() => {
    const padded = [...data];
    while (padded.length < width) {
      padded.unshift(0);
    }
    const points = padded.slice(-width);
    const result: { char: string; color: string }[][] = [];

    for (let r = height - 1; r >= 0; r--) {
      const rowCells: { char: string; color: string }[] = [];
      const rowMinPct = (r / height) * 100;
      const rowMaxPct = ((r + 1) / height) * 100;

      for (let c = 0; c < points.length; c++) {
        const val = Math.min(100, Math.max(0, points[c] ?? 0));

        // Determine color based on vertical level
        let cellColor = color ?? 'green';
        if (gradient) {
          const overallPct = (r / height) * 100;
          if (overallPct >= 65) cellColor = '#ff6e6e'; // coral / red
          else if (overallPct >= 35) cellColor = '#f1fa8c'; // yellow / sand
          else cellColor = '#50fa7b'; // green
        }

        if (val <= rowMinPct) {
          rowCells.push({ char: ' ', color: cellColor });
        } else if (val >= rowMaxPct) {
          // If it's near the top peak, give it btop's textured look
          const isPeak = val >= rowMaxPct && (r === height - 1 || (points[c] ?? 0) <= ((r + 2) / height) * 100);
          rowCells.push({ char: isPeak && r > 1 ? '▒' : '█', color: cellColor });
        } else {
          const fraction = (val - rowMinPct) / (rowMaxPct - rowMinPct);
          const index = Math.min(8, Math.max(1, Math.round(fraction * 8)));
          rowCells.push({ char: BLOCKS[index] ?? '▄', color: cellColor });
        }
      }
      result.push(rowCells);
    }

    return result;
  }, [data, width, height, color, gradient]);

  return (
    <Box flexDirection="column">
      {rows.map((row, rIdx) => (
        <Box key={rIdx}>
          {row.map((cell, cIdx) => (
            <Text key={cIdx} color={cell.color}>
              {cell.char}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};

/**
 * btop-style dual-direction network graph (download up, upload inverted down).
 */
export const NetGraph: React.FC<{
  rxData: number[];
  txData: number[];
  width?: number;
  height?: number;
}> = ({ rxData, txData, width = 24, height = 2 }) => {
  const pad = (arr: number[]) => {
    const copy = [...arr];
    while (copy.length < width) copy.unshift(0);
    return copy.slice(-width);
  };

  const rx = pad(rxData);
  const tx = pad(txData);

  // RX rows (growing upwards)
  const rxRows: string[][] = [];
  for (let r = height - 1; r >= 0; r--) {
    const row: string[] = [];
    const minP = (r / height) * 100;
    const maxP = ((r + 1) / height) * 100;
    for (let c = 0; c < width; c++) {
      const v = Math.min(100, Math.max(0, rx[c] ?? 0));
      if (v <= minP) row.push(' ');
      else if (v >= maxP) row.push('█');
      else row.push('▄');
    }
    rxRows.push(row);
  }

  // TX rows (growing downwards)
  const txRows: string[][] = [];
  for (let r = 0; r < height; r++) {
    const row: string[] = [];
    const minP = (r / height) * 100;
    const maxP = ((r + 1) / height) * 100;
    for (let c = 0; c < width; c++) {
      const v = Math.min(100, Math.max(0, tx[c] ?? 0));
      if (v <= minP) row.push(' ');
      else if (v >= maxP) row.push('█');
      else row.push('▀');
    }
    txRows.push(row);
  }

  return (
    <Box flexDirection="column">
      {/* Top: RX (Purple / Cyan) */}
      {rxRows.map((row, i) => (
        <Box key={`rx-${i}`}>
          {row.map((ch, j) => (
            <Text key={j} color="#bd93f9">
              {ch}
            </Text>
          ))}
        </Box>
      ))}
      {/* Divider center line */}
      <Box>
        <Text dimColor>{'─'.repeat(width)}</Text>
      </Box>
      {/* Bottom: TX (Magenta / Red) */}
      {txRows.map((row, i) => (
        <Box key={`tx-${i}`}>
          {row.map((ch, j) => (
            <Text key={j} color="#ff79c6">
              {ch}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  );
};
