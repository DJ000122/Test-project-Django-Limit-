'use client';

import {
  Box,
  Chip,
  Grid,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, FullWidthRow, SkeletonRows } from '@/components/States';
import { formatCurrency, formatDate } from '@/lib/format';
import { useNeedsMaintenance, useOfficeSummary, useWorkload } from '@/lib/queries';

function Kpi({ label, value, loading }: { label: string; value: ReactNode; loading: boolean }) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        fontWeight={700}
        sx={{ mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
      >
        {loading ? <Skeleton width={120} /> : value}
      </Typography>
    </Paper>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Paper sx={{ height: '100%', overflow: 'hidden' }}>
      <Box sx={{ px: 2, pt: 2, pb: 1 }}>
        <Typography variant="h6" component="h2" fontWeight={600}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {children}
    </Paper>
  );
}

function NeedsMaintenance() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const pageSize = 8;
  const query = useNeedsMaintenance({ page: page + 1, page_size: pageSize });
  const rows = query.data?.results ?? [];

  return (
    <Section
      title={`Needs maintenance${query.data ? ` (${query.data.count})` : ''}`}
      subtitle="Active vehicles never serviced or last serviced over 365 days ago, most overdue first."
    >
      <TableContainer>
        <Table size="small" aria-label="Vehicles needing maintenance">
          <TableHead>
            <TableRow>
              <TableCell>Vehicle</TableCell>
              <TableCell>Office</TableCell>
              <TableCell>Last service</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading ? (
              <SkeletonRows columns={3} rows={pageSize} />
            ) : query.isError ? (
              <FullWidthRow columns={3}>
                <ErrorState error={query.error} onRetry={() => query.refetch()} />
              </FullWidthRow>
            ) : rows.length === 0 ? (
              <FullWidthRow columns={3}>
                <EmptyState
                  title="All caught up"
                  description="Every active vehicle was serviced in the last year."
                />
              </FullWidthRow>
            ) : (
              rows.map((v) => (
                <TableRow
                  key={v.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/vehicles/${v.id}`)}
                >
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{ fontFamily: 'var(--font-geist-mono)' }}
                    >
                      {v.license_plate}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {v.year} {v.make} {v.model}
                    </Typography>
                  </TableCell>
                  <TableCell>{v.office_detail.name}</TableCell>
                  <TableCell>
                    {v.last_maintenance ? (
                      <>
                        {formatDate(v.last_maintenance)}
                        <Typography variant="caption" color="warning.main" component="div">
                          {v.days_since_maintenance} days ago
                        </Typography>
                      </>
                    ) : (
                      <Chip size="small" color="error" variant="outlined" label="Never serviced" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {(query.data?.count ?? 0) > pageSize && (
        <TablePagination
          component="div"
          count={query.data?.count ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[pageSize]}
          onPageChange={(_, p) => setPage(p)}
        />
      )}
    </Section>
  );
}

function Workload() {
  const query = useWorkload({ page_size: 8 });
  const rows = query.data?.results ?? [];
  const max = Math.max(1, ...rows.map((r) => r.records_this_year));
  const year = new Date().getFullYear();

  return (
    <Section title="Mechanic workload" subtitle={`Services completed in ${year}, busiest first.`}>
      <Box sx={{ px: 2, pb: 2 }}>
        {query.isLoading ? (
          Array.from({ length: 6 }, (_, i) => <Skeleton key={i} height={44} />)
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="No mechanics yet" />
        ) : (
          rows.map((m) => (
            <Box key={m.id} sx={{ py: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <MuiLink
                  component={Link}
                  href={`/vehicles?mechanic_certification=${encodeURIComponent(m.certification_number)}&maintenance_from=${year}-01-01`}
                  underline="hover"
                  color="inherit"
                  variant="body2"
                  fontWeight={500}
                >
                  {m.name}
                  {!m.active && (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      · inactive
                    </Typography>
                  )}
                </MuiLink>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {m.records_this_year} jobs · {formatCurrency(m.cost_this_year)}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(m.records_this_year / max) * 100}
                sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
                aria-label={`${m.name}: ${m.records_this_year} services`}
              />
            </Box>
          ))
        )}
      </Box>
    </Section>
  );
}

export default function OverviewPage() {
  const summary = useOfficeSummary();
  const offices = summary.data ?? [];
  const totalActive = offices.reduce((n, o) => n + o.active_vehicle_count, 0);
  const totalCost = offices.reduce((n, o) => n + o.maintenance_cost_last_year, 0);
  const overdue = useNeedsMaintenance({ page: 1, page_size: 8 });

  return (
    <>
      <PageHeader title="Fleet overview" subtitle="Where the fleet stands today." />

      {summary.isError && (
        <Box sx={{ mb: 2 }}>
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        </Box>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Kpi
            label="Active vehicles"
            value={totalActive.toLocaleString()}
            loading={summary.isLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Kpi
            label="Maintenance spend, last 12 months"
            value={formatCurrency(totalCost)}
            loading={summary.isLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Kpi
            label="Vehicles overdue for service"
            value={overdue.data?.count ?? 0}
            loading={overdue.isLoading}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <NeedsMaintenance />
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Workload />
        </Grid>
      </Grid>
    </>
  );
}
