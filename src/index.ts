// Load .env FIRST — before any other import reads process.env
import dotenv from 'dotenv';
dotenv.config();

import React from 'react';
import { render } from 'ink';
import AuthScreen from './ui/screens/AuthScreen.js';
import DiagnosticScreen from './ui/screens/DiagnosticScreen.js';

// 1. Global Uncaught Exception & Unhandled Rejection Logging
process.on('uncaughtException', (err: Error) => {
  console.error('\n[FATAL uncaughtException]:', err.stack || err.message || err);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('\n[FATAL unhandledRejection]:', reason);
});

// 2. TTY and Environment Diagnostics Logging
console.error('==================================================');
console.error('[DIAGNOSTIC] Process Startup Telemetry:');
console.error(`  • Node.js Version  : ${process.version} (${process.platform} ${process.arch})`);
console.error(`  • Process PID      : ${process.pid}`);
console.error(`  • stdin.isTTY      : ${Boolean(process.stdin.isTTY)}`);
console.error(`  • stdout.isTTY     : ${Boolean(process.stdout.isTTY)}`);
console.error(`  • stdout Dimensions: ${process.stdout.columns ?? 'undefined'} cols × ${process.stdout.rows ?? 'undefined'} rows`);
console.error(`  • stdout Writable  : ${process.stdout.writable}`);
console.error('==================================================');

// 3. Render Mode Selection (Diagnostic mode can be triggered via DIAGNOSTIC_MODE=1)
const isDiagnostic = process.env['DIAGNOSTIC_MODE'] === 'true' || process.env['DIAGNOSTIC_MODE'] === '1';

console.error(`[LIFECYCLE]: React Ink render() function invoked at ${new Date().toISOString()} (Screen: ${isDiagnostic ? 'DiagnosticScreen' : 'AuthScreen'})`);

// 4. Render Root Screen
const rootElement = isDiagnostic
  ? React.createElement(DiagnosticScreen)
  : React.createElement(AuthScreen);

const instance = render(rootElement);

instance.waitUntilExit().then(() => {
  console.error(`[LIFECYCLE]: React Ink instance exited cleanly at ${new Date().toISOString()}`);
}).catch((err: Error) => {
  console.error('[LIFECYCLE ERROR]: Ink instance exited with error:', err);
});
