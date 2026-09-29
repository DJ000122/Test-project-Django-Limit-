'use client';

import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowBack from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import AssignOfficeDialog from '@/components/AssignOfficeDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import DeleteVehicleDialog from '@/components/DeleteVehicleDialog';
import MaintenanceFormDialog from '@/components/MaintenanceFormDialog';
import { useNotify } from '@/components/Notifier';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import { EmptyState, ErrorState, FullWidthRow } from '@/components/States';
import VehicleFormDialog from '@/components/VehicleFormDialog';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatCurrency, formatDate } from '@/lib/format';
import { daysSince, maintenanceStatus } from '@/lib/maintenance-status';
import { keys, useVehicle } from '@/lib/queries';
import type { MaintenanceHistoryItem } from '@/lib/types';
import { LAST_SEARCH_KEY } from '../VehiclesView';

const HISTORY_PAGE_SIZE = 25;

function useLastVehicleSearchHref() {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const last = sessionStorage.getItem(LAST_SEARCH_KEY);
        return last ? `/vehicles?${last}` : '/vehicles';
      } catch {
        return '/vehicles';
      }
    },
    () => '/vehicles',
  );
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="overline" color="text.secondary" lineHeight={1.5}>
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={600} component="div">
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" component="div">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

export default function VehicleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vehicleId = Number(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const vehicle = useVehicle(vehicleId);

  const backHref = useLastVehicleSearchHref();
  const [historyPage, setHistoryPage] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recordDialog, setRecordDialog] = useState<{
    record: MaintenanceHistoryItem | null;
  } | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<MaintenanceHistoryItem | null>(null);

  const deleteRecord = useMutation({
    mutationFn: (recordId: number) => api.deleteRecord(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.vehicles });
      queryClient.invalidateQueries({ queryKey: keys.offices });
      queryClient.invalidateQueries({ queryKey: keys.mechanics });
      notify('Maintenance record deleted');
      setRecordToDelete(null);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const back = (
    <Button
      component={Link}
      href={backHref}
      startIcon={<ArrowBack />}
      size="small"
      sx={{ mb: 1, ml: -1 }}
    >
      Back to vehicles
    </Button>
  );

  if (vehicle.isLoading) {
    return (
      <>
        {back}
        <Skeleton variant="text" width={320} height={48} />
        <Grid container spacing={2} sx={{ my: 2 }}>
          {Array.from({ length: 4 }, (_, i) => (
            <Grid key={i} size={{ xs: 6, md: 3 }}>
              <Skeleton variant="rounded" height={88} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={320} />
      </>
    );
  }

  if (vehicle.isError || !vehicle.data) {
    const notFound = isAxiosError(vehicle.error) && vehicle.error.response?.status === 404;
    return (
      <>
        {back}
        {notFound ? (
          <EmptyState
            title="Vehicle not found"
            description="It may have been deleted."
            action={
              <Button component={Link} href="/vehicles" variant="outlined">
                Browse vehicles
              </Button>
            }
          />
        ) : (
          <ErrorState error={vehicle.error} onRetry={() => vehicle.refetch()} />
        )}
      </>
    );
  }

  const v = vehicle.data;
  const status = maintenanceStatus(v.last_maintenance, v.active);
  const days = daysSince(v.last_maintenance);
  const history = v.maintenance_records;
  const pageRows = history.slice(
    historyPage * HISTORY_PAGE_SIZE,
    (historyPage + 1) * HISTORY_PAGE_SIZE,
  );

  return (
    <>
      {back}
      <PageHeader
        title={
          <Box
            component="span"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}
          >
            <span>
              {v.year} {v.make} {v.model}
            </span>
            <Chip
              label={v.active ? 'Active' : 'Inactive'}
              color={v.active ? 'success' : 'default'}
              size="small"
            />
            {status && (
              <Chip label={status.label} color={status.color} size="small" variant="outlined" />
            )}
          </Box>
        }
        subtitle={
          <Box component="span" sx={{ fontFamily: 'var(--font-geist-mono)' }}>
            {v.license_plate} · VIN {v.vin}
          </Box>
        }
        actions={
          <>
            <Button variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outlined" onClick={() => setAssignOpen(true)}>
              Assign to office
            </Button>
            {(v.active || v.maintenance_count === 0) && (
              <Button variant="outlined" color="error" onClick={() => setDeleteOpen(true)}>
                {v.maintenance_count > 0 ? 'Deactivate' : 'Delete'}
              </Button>
            )}
          </>
        }
      />

      {status && (
        <Alert
          severity={status.color}
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setRecordDialog({ record: null })}>
              Record service
            </Button>
          }
        >
          {days === null
            ? 'This vehicle has never been serviced.'
            : `Last serviced ${days} days ago, more than a year.`}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat
            label="Office"
            value={
              <MuiLink
                component={Link}
                href={`/vehicles?office=${v.office}`}
                underline="hover"
                color="inherit"
              >
                {v.office_detail.name}
              </MuiLink>
            }
            hint={v.office_detail.city}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat
            label="Last service"
            value={formatDate(v.last_maintenance, 'Never')}
            hint={days !== null ? `${days} day${days === 1 ? '' : 's'} ago` : undefined}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat label="Services on record" value={v.maintenance_count.toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Stat
            label="Lifetime maintenance cost"
            value={formatCurrency(v.total_maintenance_cost)}
          />
        </Grid>
      </Grid>

      <Paper>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 2, py: 1.5 }}
        >
          <Typography variant="h6" component="h2" fontWeight={600}>
            Maintenance history
          </Typography>
          <Button
            startIcon={<AddOutlined />}
            variant="contained"
            onClick={() => setRecordDialog({ record: null })}
          >
            Record maintenance
          </Button>
        </Stack>
        <TableContainer>
          <Table size="small" aria-label="Maintenance history">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Mechanic</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {history.length === 0 ? (
                <FullWidthRow columns={6}>
                  <EmptyState
                    title="No maintenance recorded"
                    description="Services you record will appear here, newest first."
                  />
                </FullWidthRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.maintenance_type_display}</TableCell>
                    <TableCell>
                      <MuiLink
                        component={Link}
                        href={`/vehicles?mechanic_certification=${encodeURIComponent(r.mechanic.certification_number)}`}
                        underline="hover"
                        color="inherit"
                        title="Other vehicles serviced by this mechanic"
                      >
                        {r.mechanic.name}
                      </MuiLink>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {r.mechanic.certification_number}
                        {!r.mechanic.active && ' · inactive'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(r.cost)}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 360 }}>
                      {r.notes || '–'}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <RowActions
                        label={`record from ${r.date}`}
                        actions={[
                          { label: 'Edit', onClick: () => setRecordDialog({ record: r }) },
                          { label: 'Delete', danger: true, onClick: () => setRecordToDelete(r) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {history.length > HISTORY_PAGE_SIZE && (
          <TablePagination
            component="div"
            count={history.length}
            page={historyPage}
            rowsPerPage={HISTORY_PAGE_SIZE}
            rowsPerPageOptions={[HISTORY_PAGE_SIZE]}
            onPageChange={(_, p) => setHistoryPage(p)}
          />
        )}
      </Paper>

      <VehicleFormDialog open={editOpen} vehicle={v} onClose={() => setEditOpen(false)} />
      <AssignOfficeDialog open={assignOpen} vehicle={v} onClose={() => setAssignOpen(false)} />
      <DeleteVehicleDialog
        vehicle={deleteOpen ? v : null}
        hasHistory={v.maintenance_count > 0}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => router.push(backHref)}
      />
      <MaintenanceFormDialog
        open={recordDialog !== null}
        vehicleId={v.id}
        record={recordDialog?.record}
        onClose={() => setRecordDialog(null)}
      />
      <ConfirmDialog
        open={recordToDelete !== null}
        title="Delete maintenance record?"
        body={
          recordToDelete &&
          `${recordToDelete.maintenance_type_display} on ${formatDate(recordToDelete.date)} (${formatCurrency(recordToDelete.cost)}) will be permanently removed.`
        }
        pending={deleteRecord.isPending}
        onConfirm={() => recordToDelete && deleteRecord.mutate(recordToDelete.id)}
        onClose={() => setRecordToDelete(null)}
      />
    </>
  );
}
