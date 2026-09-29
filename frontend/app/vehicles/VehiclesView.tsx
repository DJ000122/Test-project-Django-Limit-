'use client';

import AddOutlined from '@mui/icons-material/AddOutlined';
import {
  Box,
  Button,
  Chip,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import DeleteVehicleDialog from '@/components/DeleteVehicleDialog';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import { EmptyState, ErrorState, FullWidthRow, SkeletonRows } from '@/components/States';
import VehicleFilters, { VEHICLE_FILTER_KEYS } from '@/components/VehicleFilters';
import VehicleFormDialog from '@/components/VehicleFormDialog';
import { formatDate } from '@/lib/format';
import { maintenanceStatus } from '@/lib/maintenance-status';
import { useVehicles } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';
import { useUrlState } from '@/lib/use-url-state';

const URL_KEYS = [...VEHICLE_FILTER_KEYS, 'ordering', 'page', 'page_size'] as const;
const PAGE_SIZES = [10, 25, 50];
const COLUMNS = 7;
export const LAST_SEARCH_KEY = 'fleet:last-vehicle-search';

const SORTABLE: { key: string; label: string }[] = [
  { key: 'license_plate', label: 'Plate' },
  { key: 'make', label: 'Vehicle' },
  { key: 'year', label: 'Year' },
  { key: 'office__name', label: 'Office' },
];

export default function VehiclesView() {
  const router = useRouter();
  const { values, update, clear } = useUrlState(URL_KEYS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const page = Math.max(1, Number(values.page) || 1);
  const pageSize = PAGE_SIZES.includes(Number(values.page_size)) ? Number(values.page_size) : 10;
  const datesInvalid =
    values.maintenance_from &&
    values.maintenance_to &&
    values.maintenance_from > values.maintenance_to;

  const params = {
    ...Object.fromEntries(VEHICLE_FILTER_KEYS.map((k) => [k, values[k]])),
    ...(datesInvalid ? { maintenance_from: '', maintenance_to: '' } : {}),
    ordering: values.ordering,
    page,
    page_size: pageSize,
  };
  const vehicles = useVehicles(params);

  // Remember the current search so "Back to vehicles" on a detail page restores it.
  const search = useSearchParams().toString();
  useEffect(() => {
    try {
      sessionStorage.setItem(LAST_SEARCH_KEY, search);
    } catch {
      /* storage unavailable: back link falls back to the unfiltered list */
    }
  }, [search]);
  const rows = vehicles.data?.results ?? [];
  const hasFilters = VEHICLE_FILTER_KEYS.some((k) => values[k]);

  const sortBy = (key: string) => {
    const current = values.ordering;
    update({ ordering: current === key ? `-${key}` : current === `-${key}` ? null : key });
  };
  const sortState = (key: string) =>
    values.ordering === key ? 'asc' : values.ordering === `-${key}` ? 'desc' : false;

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle="Search the fleet by office, status, make, model and service history."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add vehicle
          </Button>
        }
      />

      <VehicleFilters values={values} onChange={update} onClear={clear} />

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {vehicles.isFetching && !vehicles.isLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <Typography variant="body2" color="text.secondary" aria-live="polite">
            {vehicles.data
              ? `${vehicles.data.count.toLocaleString()} vehicle${vehicles.data.count === 1 ? '' : 's'}${hasFilters ? ' match' : ''}`
              : ' '}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small" aria-label="Vehicles">
            <TableHead>
              <TableRow>
                {SORTABLE.map((col) => (
                  <TableCell key={col.key} sortDirection={sortState(col.key) || false}>
                    <TableSortLabel
                      active={Boolean(sortState(col.key))}
                      direction={sortState(col.key) || 'asc'}
                      onClick={() => sortBy(col.key)}
                    >
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>Status</TableCell>
                <TableCell sortDirection={sortState('last_maintenance') || false}>
                  <TableSortLabel
                    active={Boolean(sortState('last_maintenance'))}
                    direction={sortState('last_maintenance') || 'asc'}
                    onClick={() => sortBy('last_maintenance')}
                  >
                    Last service
                  </TableSortLabel>
                </TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.isLoading ? (
                <SkeletonRows columns={COLUMNS} rows={pageSize} />
              ) : vehicles.isError ? (
                <FullWidthRow columns={COLUMNS}>
                  <ErrorState error={vehicles.error} onRetry={() => vehicles.refetch()} />
                </FullWidthRow>
              ) : rows.length === 0 ? (
                <FullWidthRow columns={COLUMNS}>
                  {hasFilters ? (
                    <EmptyState
                      title="No vehicles match these filters"
                      description="Try widening the date range or removing a filter."
                      action={<Button onClick={clear}>Clear filters</Button>}
                    />
                  ) : (
                    <EmptyState
                      title="No vehicles yet"
                      description="Add your first vehicle, or run `python manage.py seed_fleet` for demo data."
                    />
                  )}
                </FullWidthRow>
              ) : (
                rows.map((v) => {
                  const status = maintenanceStatus(v.last_maintenance, v.active);
                  return (
                    <TableRow
                      key={v.id}
                      hover
                      onClick={() => router.push(`/vehicles/${v.id}`)}
                      sx={{ cursor: 'pointer', opacity: v.active ? 1 : 0.65 }}
                    >
                      <TableCell sx={{ fontFamily: 'var(--font-geist-mono)', fontWeight: 600 }}>
                        {v.license_plate}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {v.make} {v.model}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontFamily: 'var(--font-geist-mono)' }}
                        >
                          {v.vin}
                        </Typography>
                      </TableCell>
                      <TableCell>{v.year}</TableCell>
                      <TableCell>{v.office_detail.name}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={v.active ? 'Active' : 'Inactive'}
                          color={v.active ? 'success' : 'default'}
                          variant={v.active ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDate(v.last_maintenance, 'Never')}
                          {status && (
                            <Chip
                              size="small"
                              variant="outlined"
                              color={status.color}
                              label={status.label}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell padding="checkbox">
                        <RowActions
                          label={v.license_plate}
                          actions={[
                            {
                              label: 'View details',
                              onClick: () => router.push(`/vehicles/${v.id}`),
                            },
                            {
                              label: 'Edit',
                              onClick: () => {
                                setEditing(v);
                                setFormOpen(true);
                              },
                            },
                            {
                              label: v.last_maintenance ? 'Deactivate' : 'Delete',
                              danger: true,
                              disabled: Boolean(v.last_maintenance) && !v.active,
                              onClick: () => setDeleting(v),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={vehicles.data?.count ?? 0}
          page={vehicles.data ? page - 1 : 0}
          rowsPerPage={pageSize}
          rowsPerPageOptions={PAGE_SIZES}
          onPageChange={(_, p) => update({ page: p === 0 ? null : String(p + 1) })}
          onRowsPerPageChange={(e) =>
            update({ page_size: e.target.value === '10' ? null : e.target.value })
          }
        />
      </Paper>

      <VehicleFormDialog
        open={formOpen}
        vehicle={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => !editing && router.push(`/vehicles/${saved.id}`)}
      />
      <DeleteVehicleDialog
        vehicle={deleting}
        hasHistory={Boolean(deleting?.last_maintenance)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
