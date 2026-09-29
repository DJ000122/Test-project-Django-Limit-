import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import Providers from './providers';
import AppShell from '@/components/AppShell';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Fleet Tracker', template: '%s · Fleet Tracker' },
  description: 'Vehicles, offices, mechanics and maintenance history',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppRouterCacheProvider>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
