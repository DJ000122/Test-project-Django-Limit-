'use client';

import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { parseApiError, type ApiErrors } from '@/lib/errors';
import { keys, useFacets, useOfficeOptions } from '@/lib/queries';
import type { Vehicle, VehicleInput } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { useNotify } from './Notifier';

type FormState = Omit<VehicleInput, 'year' | 'office'> & { year: string; office: string };

const blank: FormState = {
  vin: '',
  license_plate: '',
  make: '',
  model: '',
  year: String(new Date().getFullYear()),
  office: '',
  active: true,
};

const fromVehicle = (v: Vehicle): FormState => ({
  vin: v.vin,
  license_plate: v.license_plate,
  make: v.make,
  model: v.model,
  year: String(v.year),
  office: String(v.office),
  active: v.active,
});

const CONFLICT_TEXT = {
  vin: 'Another vehicle already has this VIN.',
  license_plate: 'An active vehicle already uses this plate.',
} as const;

export default function VehicleFormDialog({
  open,
  vehicle,
  onClose,
  onSaved,
}: {
  open: boolean;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onSaved?: (vehicle: Vehicle) => void;
}) {
  const isEdit = Boolean(vehicle);
  const [form, setForm] = useState<FormState>(blank);
  const [errors, setErrors] = useState<ApiErrors>({ fields: {}, message: null });
  const offices = useOfficeOptions();
  const facets = useFacets();
  const queryClient = useQueryClient();
  const notify = useNotify();

  // Reset the form each time the dialog opens (state adjusted during render,
  // per https://react.dev/learn/you-might-not-need-an-effect).
  const [openedFor, setOpenedFor] = useState<{ open: boolean; vehicle?: Vehicle | null }>({
    open: false,
  });
  if (openedFor.open !== open || (open && openedFor.vehicle !== vehicle)) {
    setOpenedFor({ open, vehicle });
    if (open) {
      setForm(vehicle ? fromVehicle(vehicle) : blank);
      setErrors({ fields: {}, message: null });
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, fields: { ...e.fields, [key]: '' } }));
  };

  // Live duplicate check against the API (debounced).
  const dupParams = useDebounced(
    { vin: form.vin.trim(), license_plate: form.license_plate.trim(), active: form.active },
    400,
  );
  const duplicate = useQuery({
    queryKey: [...keys.vehicles, 'duplicate', dupParams, vehicle?.id],
    queryFn: () => api.checkDuplicate({ ...dupParams, exclude: vehicle?.id }),
    enabled: open && Boolean(dupParams.vin || dupParams.license_plate),
    staleTime: 0,
  });
  const conflicts = new Set(duplicate.data?.conflicts ?? []);

  const save = useMutation({
    mutationFn: (body: VehicleInput) =>
      vehicle ? api.updateVehicle(vehicle.id, body) : api.createVehicle(body),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: keys.vehicles });
      queryClient.invalidateQueries({ queryKey: keys.offices });
      notify(isEdit ? 'Vehicle updated' : `Vehicle ${saved.license_plate} created`);
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => setErrors(parseApiError(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    save.mutate({
      ...form,
      vin: form.vin.trim(),
      license_plate: form.license_plate.trim(),
      make: form.make.trim(),
      model: form.model.trim(),
      year: Number(form.year),
      office: Number(form.office),
    });
  };

  const fieldError = (key: keyof FormState) =>
    errors.fields[key] ||
    (key in CONFLICT_TEXT && conflicts.has(key as 'vin' | 'license_plate')
      ? CONFLICT_TEXT[key as 'vin' | 'license_plate']
      : '');

  const makes = facets.data?.makes ?? [];
  const models = makes.find((m) => m.make.toLowerCase() === form.make.toLowerCase())?.models ?? [];

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{isEdit ? 'Edit vehicle' : 'Add vehicle'}</DialogTitle>
        <DialogContent>
          {errors.message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.message}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="VIN"
                value={form.vin}
                onChange={(e) => set('vin', e.target.value.toUpperCase())}
                required
                fullWidth
                autoFocus={!isEdit}
                slotProps={{
                  htmlInput: { maxLength: 17, style: { fontFamily: 'var(--font-geist-mono)' } },
                }}
                error={Boolean(fieldError('vin'))}
                helperText={fieldError('vin') || `${form.vin.length}/17 characters, no I, O or Q`}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="License plate"
                value={form.license_plate}
                onChange={(e) => set('license_plate', e.target.value.toUpperCase())}
                required
                fullWidth
                error={Boolean(fieldError('license_plate'))}
                helperText={fieldError('license_plate') || ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <Autocomplete
                freeSolo
                options={makes.map((m) => m.make)}
                inputValue={form.make}
                onInputChange={(_, value) => set('make', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Make"
                    required
                    size="small"
                    error={Boolean(errors.fields.make)}
                    helperText={errors.fields.make}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Autocomplete
                freeSolo
                options={models}
                inputValue={form.model}
                onInputChange={(_, value) => set('model', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Model"
                    required
                    size="small"
                    error={Boolean(errors.fields.model)}
                    helperText={errors.fields.model}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField
                label="Year"
                type="number"
                value={form.year}
                onChange={(e) => set('year', e.target.value)}
                required
                fullWidth
                error={Boolean(errors.fields.year)}
                helperText={errors.fields.year}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                select
                label="Office"
                value={form.office}
                onChange={(e) => set('office', e.target.value)}
                required
                fullWidth
                disabled={isEdit}
                error={Boolean(errors.fields.office)}
                helperText={
                  errors.fields.office ||
                  (isEdit ? 'Use "Assign to office" on the vehicle page to move it.' : ' ')
                }
              >
                {(offices.data ?? []).map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.name} · {o.city}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'flex-start' }}>
              <FormControlLabel
                control={
                  <Switch checked={form.active} onChange={(e) => set('active', e.target.checked)} />
                }
                label={form.active ? 'Active' : 'Inactive'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={save.isPending}>
            {isEdit ? 'Save changes' : 'Add vehicle'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
