'use client';

import AddOutlined from '@mui/icons-material/AddOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import {
  Box,
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotify } from '@/components/Notifier';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import SimpleFormDialog from '@/components/SimpleFormDialog';
import { EmptyState, ErrorState, FullWidthRow, SkeletonRows } from '@/components/States';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { keys, useMechanics } from '@/lib/queries';
import type { Mechanic } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { useUrlState } from '@/lib/use-url-state';

const URL_KEYS = ['search', 'active', 'page'] as const;
const PAGE_SIZE = 10;
const COLUMNS = 4;

export default function MechanicsView() {
  const router = useRouter();
  const { values, update } = useUrlState(URL_KEYS);
  const page = Math.max(1, Number(values.page) || 1);
  const mechanics = useMechanics({
    search: values.search,
    active: values.active,
    page,
    page_size: PAGE_SIZE,
  });
  const rows = mechanics.data?.results ?? [];
  const queryClient = useQueryClient();
  const notify = useNotify();

  const [search, setSearch] = useState(values.search);
  const debounced = useDebounced(search, 350);
  // Follow external URL changes (Back button, "Clear filters").
  const [urlSearch, setUrlSearch] = useState(values.search);
  if (urlSearch !== values.search) {
    setUrlSearch(values.search);
    setSearch(values.search);
  }
  useEffect(() => {
    if (debounced !== values.search) update({ search: debounced }, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const [dialog, setDialog] = useState<{ mechanic: Mechanic | null } | null>(null);
  const [deleting, setDeleting] = useState<Mechanic | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.mechanics });

  const toggleActive = useMutation({
    mutationFn: (m: Mechanic) => api.updateMechanic(m.id, { active: !m.active }),
    onSuccess: (m) => {
      refresh();
      notify(`${m.name} ${m.active ? 'reactivated' : 'deactivated'}`);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.deleteMechanic(id),
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

  const filtered = Boolean(values.search || values.active);

  return (
    <>
      <PageHeader
        title="Mechanics"
        subtitle="Certified mechanics who perform maintenance. Inactive mechanics keep their history."
        actions={
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setDialog({ mechanic: null })}
          >
            Add mechanic
          </Button>
        }
      />
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search name or certification"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search mechanics' },
          }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={values.active}
          onChange={(_, v: string | null) => update({ active: v ?? '' })}
          aria-label="Mechanic status"
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="true">Active</ToggleButton>
          <ToggleButton value="false">Inactive</ToggleButton>
        </ToggleButtonGroup>
      </Paper>

      <Paper sx={{ position: 'relative', overflow: 'hidden' }}>
        {mechanics.isFetching && !mechanics.isLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}
        <TableContainer>
          <Table size="small" aria-label="Mechanics">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Certification</TableCell>
                <TableCell>Status</TableCell>
                <TableCell padding="checkbox" />
              </TableRow>
            </TableHead>
            <TableBody>
              {mechanics.isLoading ? (
                <SkeletonRows columns={COLUMNS} rows={PAGE_SIZE} />
              ) : mechanics.isError ? (
                <FullWidthRow columns={COLUMNS}>
                  <ErrorState error={mechanics.error} onRetry={() => mechanics.refetch()} />
                </FullWidthRow>
              ) : rows.length === 0 ? (
                <FullWidthRow columns={COLUMNS}>
                  <EmptyState
                    title={filtered ? 'No mechanics match' : 'No mechanics yet'}
                    description={filtered ? 'Try a different search or status.' : undefined}
                  />
                </FullWidthRow>
              ) : (
                rows.map((m) => (
                  <TableRow key={m.id} hover sx={{ opacity: m.active ? 1 : 0.65 }}>
                    <TableCell sx={{ fontWeight: 500 }}>{m.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'var(--font-geist-mono)' }}>
                      {m.certification_number}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={m.active ? 'Active' : 'Inactive'}
                        color={m.active ? 'success' : 'default'}
                        variant={m.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell padding="checkbox">
                      <RowActions
                        label={m.name}
                        actions={[
                          {
                            label: 'Vehicles serviced',
                            onClick: () =>
                              router.push(
                                `/vehicles?mechanic_certification=${encodeURIComponent(m.certification_number)}`,
                              ),
                          },
                          { label: 'Edit', onClick: () => setDialog({ mechanic: m }) },
                          {
                            label: m.active ? 'Deactivate' : 'Reactivate',
                            onClick: () => toggleActive.mutate(m),
                          },
                          { label: 'Delete', danger: true, onClick: () => setDeleting(m) },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <Box>
          <TablePagination
            component="div"
            count={mechanics.data?.count ?? 0}
            page={mechanics.data ? page - 1 : 0}
            rowsPerPage={PAGE_SIZE}
            rowsPerPageOptions={[PAGE_SIZE]}
            onPageChange={(_, p) => update({ page: p === 0 ? null : String(p + 1) })}
          />
        </Box>
      </Paper>

      <SimpleFormDialog
        open={dialog !== null}
        title={dialog?.mechanic ? 'Edit mechanic' : 'Add mechanic'}
        submitLabel={dialog?.mechanic ? 'Save changes' : 'Add mechanic'}
        fields={[
          { name: 'name', label: 'Name', autoFocus: true },
          {
            name: 'certification_number',
            label: 'Certification number',
            helper: 'Must be unique, e.g. ASE-123456',
          },
          { name: 'active', label: 'Active', type: 'switch' },
        ]}
        initial={{
          name: dialog?.mechanic?.name ?? '',
          certification_number: dialog?.mechanic?.certification_number ?? '',
          active: dialog?.mechanic?.active ?? true,
        }}
        onSubmit={async (values) => {
          const body = {
            name: String(values.name).trim(),
            certification_number: String(values.certification_number).trim(),
            active: Boolean(values.active),
          };
          if (dialog?.mechanic) await api.updateMechanic(dialog.mechanic.id, body);
          else await api.createMechanic(body);
          refresh();
          notify(dialog?.mechanic ? 'Mechanic updated' : `${body.name} added`);
        }}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name}?`}
        body="Mechanics with maintenance history cannot be deleted; deactivate them instead so their records stay intact."
        pending={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
