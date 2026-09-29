'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { PropsWithChildren, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { NotifierProvider } from '@/components/Notifier';

const theme = createTheme({
  palette: {
    primary: { main: '#0f62fe' },
    background: { default: '#f5f7fb' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'var(--font-geist-sans), Roboto, Helvetica, Arial, sans-serif',
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { textTransform: 'none' } },
    },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
    MuiToggleButton: { styleOverrides: { root: { textTransform: 'none' } } },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, whiteSpace: 'nowrap' } } },
  },
});

export default function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            refetchOnWindowFocus: false,
            // Don't retry client errors (404, 400): they won't fix themselves.
            retry: (count, error) =>
              count < 2 && !(isAxiosError(error) && (error.response?.status ?? 500) < 500),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotifierProvider>{children}</NotifierProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
