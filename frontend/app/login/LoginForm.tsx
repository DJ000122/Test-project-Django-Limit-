'use client';

import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { login } from '@/lib/api-client';
import { safeNext, useSession } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

export default function LoginForm() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const session = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in (or just signed in): continue to where the user was going.
  useEffect(() => {
    if (session) router.replace(next);
  }, [session, next, router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      setError(
        status === 429
          ? 'Too many attempts. Wait a minute and try again.'
          : status === 401
            ? 'Incorrect username or password.'
            : errorMessage(err),
      );
      setPending(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        component="form"
        onSubmit={submit}
        noValidate
        sx={{ p: 4, width: '100%', maxWidth: 400 }}
      >
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
            <LocalShippingOutlined />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Fleet Tracker
            </Typography>
          </Box>
          <Box>
            <Typography variant="h5" component="h1" fontWeight={700}>
              Log in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {next === '/' ? 'Sign in to manage the fleet.' : 'Sign in to continue to that page.'}
            </Typography>
          </Box>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          <TextField
            label="Username"
            autoComplete="username"
            autoFocus
            fullWidth
            size="medium"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            fullWidth
            size="medium"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button type="submit" variant="contained" size="large" loading={pending} fullWidth>
            Log in
          </Button>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Demo login from <code>python manage.py seed_fleet</code>: demo / fleet-demo-2026
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
