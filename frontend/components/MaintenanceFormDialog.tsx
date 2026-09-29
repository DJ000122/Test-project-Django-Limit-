'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  MenuItem,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { parseApiError, type ApiErrors } from '@/lib/errors';
import { todayIso } from '@/lib/format';
import { keys, useMaintenanceTypes, useMechanicOptions } from '@/lib/queries';
import type { MaintenanceHistoryItem, MaintenanceRecordInput } from '@/lib/types';
import { useNotify } from './Notifier';

type FormState = Omit<MaintenanceRecordInput, 'vehicle' | 'mechanic'> & { mechanic: string };

export default function MaintenanceFormDialog({
  open,
  vehicleId,
  record,
  onClose,
}: {
  open: boolean;
  vehicleId: number;
  record?: MaintenanceHistoryItem | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    mechanic: '',
    date: todayIso(),
    maintenance_type: '',
    cost: '',
    notes: '',
  });
  const [errors, setErrors] = useState<ApiErrors>({ fields: {}, message: null });
  const mechanics = useMechanicOptions();
  const types = useMaintenanceTypes();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const [openedFor, setOpenedFor] = useState<{
    open: boolean;
    record?: MaintenanceHistoryItem | null;
  }>({
    open: false,
  });
  if (openedFor.open !== open || (open && openedFor.record !== record)) {
    setOpenedFor({ open, record });
    if (open) {
      setErrors({ fields: {}, message: null });
      setForm(
        record
          ? {
              mechanic: String(record.mechanic.id),
              date: record.date,
              maintenance_type: record.maintenance_type,
              cost: String(record.cost),
              notes: record.notes,
            }
          : { mechanic: '', date: todayIso(), maintenance_type: '', cost: '', notes: '' },
      );
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, fields: { ...e.fields, [key]: '' } }));
  };

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, vehicle: vehicleId, mechanic: Number(form.mechanic) };
      return record ? api.updateRecord(record.id, body) : api.createRecord(body);
    },
    onSuccess: () => {
      // Costs and dates feed the vehicle, office summary, workload and overdue list.
      queryClient.invalidateQueries({ queryKey: keys.vehicles });
      queryClient.invalidateQueries({ queryKey: keys.offices });
      queryClient.invalidateQueries({ queryKey: keys.mechanics });
      notify(record ? 'Maintenance record updated' : 'Maintenance recorded');
      onClose();
    },
    onError: (error) => setErrors(parseApiError(error)),
  });

  // Inactive mechanics can't take new work, but stay selectable on records they already own.
  const mechanicChoices = (mechanics.data ?? []).filter(
    (m) => m.active || String(m.id) === form.mechanic,
  );

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        noValidate
      >
        <DialogTitle>{record ? 'Edit maintenance record' : 'Record maintenance'}</DialogTitle>
        <DialogContent>
          {errors.message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.message}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                required
                label="Type"
                value={form.maintenance_type}
                onChange={(e) => set('maintenance_type', e.target.value)}
                error={Boolean(errors.fields.maintenance_type)}
                helperText={errors.fields.maintenance_type}
              >
                {(types.data ?? []).map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Date performed"
                type="date"
                fullWidth
                required
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
                error={Boolean(errors.fields.date)}
                helperText={errors.fields.date}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                fullWidth
                required
                label="Mechanic"
                value={form.mechanic}
                onChange={(e) => set('mechanic', e.target.value)}
                error={Boolean(errors.fields.mechanic)}
                helperText={errors.fields.mechanic}
              >
                {mechanicChoices.map((m) => (
                  <MenuItem key={m.id} value={String(m.id)}>
                    {m.name} ({m.certification_number}){m.active ? '' : ' · inactive'}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Cost"
                type="number"
                fullWidth
                required
                value={form.cost}
                onChange={(e) => set('cost', e.target.value)}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                  htmlInput: { min: 0, step: '0.01' },
                }}
                error={Boolean(errors.fields.cost)}
                helperText={errors.fields.cost}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                label="Notes"
                fullWidth
                multiline
                minRows={2}
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                error={Boolean(errors.fields.notes)}
                helperText={errors.fields.notes}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {record ? 'Save changes' : 'Save record'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
