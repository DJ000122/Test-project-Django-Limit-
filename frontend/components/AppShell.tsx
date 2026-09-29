'use client';

import AccountCircleOutlined from '@mui/icons-material/AccountCircleOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { logout } from '@/lib/api-client';
import { useSession, type SessionUser } from '@/lib/auth';

const NAV = [
  { href: '/', label: 'Overview' },
  { href: '/vehicles', label: 'Vehicles' },
  { href: '/offices', label: 'Offices' },
  { href: '/mechanics', label: 'Mechanics' },
];

const PUBLIC_PATHS = ['/login'];

function UserMenu({ user }: { user: SessionUser | null }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const name = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : '';
  return (
    <>
      <Button
        color="inherit"
        startIcon={<AccountCircleOutlined />}
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label="Account menu"
        sx={{ color: 'text.secondary' }}
      >
        {name}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {user && (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Signed in as {user.username}
            </Typography>
          </Box>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            setAnchor(null);
            void logout();
          }}
        >
          <ListItemText>Log out</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const queryClient = useQueryClient();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  useEffect(() => {
    if (session === null && !isPublic) {
      queryClient.clear();
      const next = window.location.pathname + window.location.search;
      router.replace(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`);
    }
  }, [session, isPublic, queryClient, router]);

  if (isPublic) return <>{children}</>;

  if (!session) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} aria-busy="true">
        <CircularProgress aria-label="Checking your session" />
      </Box>
    );
  }

  const current =
    NAV.slice()
      .reverse()
      .find((item) => (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)))
      ?.href ?? false;

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: 3, minHeight: { xs: 56 } }}>
            <Box
              component={Link}
              href="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                color: 'primary.main',
                textDecoration: 'none',
              }}
            >
              <LocalShippingOutlined />
              <Typography variant="h6" fontWeight={700} color="text.primary" noWrap>
                Fleet Tracker
              </Typography>
            </Box>
            <Tabs
              value={current}
              component="nav"
              aria-label="Main navigation"
              sx={{ minHeight: 56, flex: 1 }}
            >
              {NAV.map((item) => (
                <Tab
                  key={item.href}
                  value={item.href}
                  label={item.label}
                  component={Link}
                  href={item.href}
                  sx={{ minHeight: 56, textTransform: 'none', fontWeight: 500 }}
                />
              ))}
            </Tabs>
            <UserMenu user={session.user} />
          </Toolbar>
        </Container>
      </AppBar>
      <Container component="main" maxWidth="xl" sx={{ py: 4, flex: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
