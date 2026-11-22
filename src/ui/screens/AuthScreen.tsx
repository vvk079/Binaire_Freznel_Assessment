import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { AuthService } from '../../services/AuthService.js';
import DashboardScreen from './DashboardScreen.js';

const AuthScreen: React.FC = () => {
  const { exit } = useApp();
  const [auth] = useState(() => new AuthService());

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password'>('email');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useInput((input: string, key: { tab: boolean; return: boolean; ctrl: boolean }) => {
    if (key.tab) {
      setFocused((f) => (f === 'email' ? 'password' : 'email'));
    }
    if (key.return && !loading) {
      void handleSubmit();
    }
    if (key.ctrl && input === 'u') { setMode('signup'); setError(null); }
    if (key.ctrl && input === 'l') { setMode('login'); setError(null); }
    if (key.ctrl && input === 'c') { exit(); }
  });

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);

    const result = mode === 'login'
      ? await auth.signIn(email.trim(), password)
      : await auth.signUp(email.trim(), password);

    if (result.user) {
      setAuthenticated(true);
    } else {
      setError(result.error ?? 'Unknown error');
    }
    setLoading(false);
  }

  useEffect(() => () => { void auth.signOut(); }, []);

  if (authenticated) return React.createElement(DashboardScreen);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={60}>
      <Text bold color="cyan">
        {mode === 'login' ? '  🔐 Login' : '  📝 Sign Up'} — binaire-monitor
      </Text>

      <Box marginTop={1}>
        <Text color={focused === 'email' ? 'cyan' : 'white'}> Email    : </Text>
        <TextInput
          value={email}
          onChange={setEmail}
          focus={focused === 'email'}
        />
      </Box>

      <Box>
        <Text color={focused === 'password' ? 'cyan' : 'white'}> Password : </Text>
        <TextInput
          value={password}
          onChange={setPassword}
          mask="*"
          focus={focused === 'password'}
        />
      </Box>

      {error && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red"> ✖ {error}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {loading
          ? <Text color="yellow"> ⟳ Processing…</Text>
          : <Text dimColor> Tab → switch field   Enter → submit   Ctrl+C → exit</Text>
        }
        <Text dimColor>
          {mode === 'login' ? ' Ctrl+U → Sign-Up mode' : ' Ctrl+L → Login mode'}
        </Text>
      </Box>
    </Box>
  );
};

export default AuthScreen;
