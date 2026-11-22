import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import TextInput from 'ink-text-input';
import { AuthService } from '../../services/AuthService.js';
import DashboardScreen from './DashboardScreen.js';

const AuthScreen: React.FC = () => {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  const [auth, setAuth] = useState<AuthService | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focused, setFocused] = useState<'email' | 'password'>('email');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Initialize AuthService safely to avoid uncaught crash if env vars are missing
  useEffect(() => {
    try {
      const service = new AuthService();
      setAuth(service);
    } catch (err: any) {
      setConfigError(err?.message || 'Missing Firebase environment variables');
    }
  }, []);

  useInput(
    (input: string, key: { tab: boolean; return: boolean; ctrl: boolean; escape: boolean }) => {
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      // If configuration error is active, allow quick preview or exit
      if (configError) {
        if (input.toLowerCase() === 'd' || key.return) {
          setAuthenticated(true);
        } else if (input.toLowerCase() === 'q') {
          exit();
        }
        return;
      }

      if (key.tab) {
        setFocused((f) => (f === 'email' ? 'password' : 'email'));
      }
      if (key.return && !loading) {
        void handleSubmit();
      }
      if (key.ctrl && input === 'u') {
        setMode('signup');
        setError(null);
      }
      if (key.ctrl && input === 'l') {
        setMode('login');
        setError(null);
      }
    },
    { isActive: isRawModeSupported }
  );

  async function handleSubmit() {
    if (!auth) {
      setError(configError || 'Firebase authentication is not configured');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setLoading(true);
    setError(null);

    const result =
      mode === 'login'
        ? await auth.signIn(email.trim(), password)
        : await auth.signUp(email.trim(), password);

    if (result.user) {
      setAuthenticated(true);
    } else {
      setError(result.error ?? 'Unknown error');
    }
    setLoading(false);
  }

  useEffect(() => {
    return () => {
      if (auth) {
        void auth.signOut();
      }
    };
  }, [auth]);

  if (authenticated) {
    return React.createElement(DashboardScreen);
  }

  // Graceful fallback screen when Firebase credentials are not yet configured in environment
  if (configError) {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1} width={64}>
        <Text bold color="yellow">⚠️ Firebase Configuration Warning</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="white">Authentication service could not connect:</Text>
          <Text color="red">  ✖ {configError}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Please ensure the following environment variables are configured in .env or Render:</Text>
          <Text dimColor>  • FIREBASE_API_KEY</Text>
          <Text dimColor>  • FIREBASE_AUTH_DOMAIN</Text>
          <Text dimColor>  • FIREBASE_PROJECT_ID</Text>
        </Box>
        <Box marginTop={1} justifyContent="space-between">
          <Text bold color="cyan">[D / Enter] Launch Dashboard (Preview Mode)</Text>
          <Text color="red">[Q / Ctrl+C] Exit</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={60}>
      <Text bold color="cyan">
        {mode === 'login' ? '  🔐 Login' : '  📝 Sign Up'} — binaire-monitor
      </Text>

      <Box marginTop={1}>
        <Text color={focused === 'email' ? 'cyan' : 'white'}> Email    : </Text>
        <TextInput value={email} onChange={setEmail} focus={focused === 'email'} />
      </Box>

      <Box>
        <Text color={focused === 'password' ? 'cyan' : 'white'}> Password : </Text>
        <TextInput value={password} onChange={setPassword} mask="*" focus={focused === 'password'} />
      </Box>

      {error && (
        <Box marginTop={1} flexDirection="column">
          <Text color="red"> ✖ {error}</Text>
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        {loading ? (
          <Text color="yellow"> ⟳ Processing…</Text>
        ) : (
          <Text dimColor> Tab → switch field   Enter → submit   Ctrl+C → exit</Text>
        )}
        <Text dimColor>
          {mode === 'login' ? ' Ctrl+U → Sign-Up mode' : ' Ctrl+L → Login mode'}
        </Text>
      </Box>
    </Box>
  );
};

export default AuthScreen;
