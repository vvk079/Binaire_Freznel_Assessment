import React from 'react';
import { Box, Text } from 'ink';

interface BarProps {
  pct: number;
  width?: number;
  color?: string;
  emptyColor?: string;
  showText?: boolean;
  char?: string;
}

/**
 * btop-style horizontal percentage bar.
 */
export const Bar: React.FC<BarProps> = ({
  pct,
  width = 14,
  color,
  emptyColor,
  showText = false,
  char = '█',
}) => {
  const clamped = Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct));
  const filled = Math.round((clamped / 100) * width);
  const empty = Math.max(0, width - filled);

  const autoColor = clamped <= 50 ? '#50fa7b' : clamped <= 80 ? '#f1fa8c' : '#ff5555';
  const barColor = color ?? autoColor;

  return (
    <Box>
      <Text color={barColor}>{char.repeat(filled)}</Text>
      <Text color={emptyColor} dimColor={!emptyColor}>
        {'░'.repeat(empty)}
      </Text>
      {showText && <Text color={barColor}> {Math.round(clamped)}%</Text>}
    </Box>
  );
};
