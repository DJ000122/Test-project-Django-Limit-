'use client';

import AddOutlined from '@mui/icons-material/AddOutlined';
import {
  Button,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotify } from '@/components/Notifier';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import SimpleFormDialog from '@/components/SimpleFormDialog';
import { EmptyState, ErrorState, FullWidthRow, SkeletonRows } from '@/components/States';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { formatCurrency, formatDate } from '@/lib/format';
import { keys, useOfficeSummary } from '@/lib/queries';
import type { OfficeSummary } from '@/lib/types';

const COLUMNS = 6;

export default function OfficesPage() {
  const summary = useOfficeSummary();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const [dialog, setDialog] = useState<{ office: OfficeSummary | null } | null>(null);
  const [deleting, setDeleting] = useState<OfficeSummary | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: keys.offices });
    queryClient.invalidateQueries({ queryKey: keys.vehicles });
  };

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteOffice(id),
    onSuccess: () => {
      refresh();
      notify(`${deleting?.name} deleted`);
      setDeleting(null);
    },
    onError: (error) => {
      notify(errorMessage(error), 'error');
      setDeleting(null);
    },
  });

  const rows = summary.data ?? [];

  return (
    <>
      <PageHeader
        title="Offices"
        subtitle="Active vehicles, maintenance spend over the last 12 months and latest service per office."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setDialog({ office: null })}
          >
            Add office
          </Button>
        }
      />
      <Paper>
        <TableContainer>
          <Table aria-label="Offices">
            <TableHead>
              <TableRow>
                <TableCell>Office</TableCell>
                <TableCell>City</TableCell>
                <TableCell align="right">Active vehicles</TableCell>
                <TableCell align="right">Maintenance, last 12 months</TableCell>
                <TableCell>Last maintenance</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.isLoading ? (
                <SkeletonRows columns={COLUMNS} rows={5} />
              ) : summary.isError ? (
                <FullWidthRow columns={COLUMNS}>
                  <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
                </FullWidthRow>
              ) : rows.length === 0 ? (
                <FullWidthRow columns={COLUMNS}>
                  <EmptyState
                    title="No offices yet"
                    description="Vehicles are assigned to offices, so start by adding one."
                    action={
                      <Button variant="outlined" onClick={() => setDialog({ office: null })}>
                        Add office
                      </Button>
                    }
                  />
                </FullWidthRow>
              ) : (
                rows.map((o) => (
                  <TableRow key={o.id} hover>
                    <TableCell>
                      <MuiLink
                        component={Link}
                        href={`/vehicles?office=${o.id}`}
                        underline="hover"
                        fontWeight={600}
                      >
                        {o.name}
                      </MuiLink>
                    </TableCell>
                    <TableCell>{o.city}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {o.active_vehicle_count}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(o.maintenance_cost_last_year)}
                    </TableCell>
                    <TableCell>
                      {o.last_maintenance ? (
                        formatDate(o.last_maintenance)
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No services yet
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <RowActions
                        label={o.name}
                        actions={[
                          { label: 'Edit', onClick: () => setDialog({ office: o }) },
                          { label: 'Delete', danger: true, onClick: () => setDeleting(o) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <SimpleFormDialog
        open={dialog !== null}
        title={dialog?.office ? 'Edit office' : 'Add office'}
        submitLabel={dialog?.office ? 'Save changes' : 'Add office'}
        fields={[
          { name: 'name', label: 'Name', autoFocus: true },
          { name: 'city', label: 'City' },
        ]}
        initial={{ name: dialog?.office?.name ?? '', city: dialog?.office?.city ?? '' }}
        onSubmit={async (values) => {
          const body = { name: String(values.name).trim(), city: String(values.city).trim() };
          if (dialog?.office) await api.updateOffice(dialog.office.id, body);
          else await api.createOffice(body);
          refresh();
          notify(dialog?.office ? 'Office updated' : `${body.name} added`);
        }}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Offices that still have vehicles assigned (active or not) cannot be deleted. Move those vehicles first."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
