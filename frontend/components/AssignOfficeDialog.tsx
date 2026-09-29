'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { parseApiError, type ApiErrors } from '@/lib/errors';
import { keys, useOfficeOptions } from '@/lib/queries';
import type { Vehicle } from '@/lib/types';
import { useNotify } from './Notifier';

export default function AssignOfficeDialog({
  open,
  vehicle,
  onClose,
}: {
  open: boolean;
  vehicle: Pick<Vehicle, 'id' | 'office' | 'office_detail' | 'license_plate'>;
  onClose: () => void;
}) {
  const [office, setOffice] = useState('');
  const [errors, setErrors] = useState<ApiErrors>({ fields: {}, message: null });
  const offices = useOfficeOptions();
  const queryClient = useQueryClient();
  const notify = useNotify();

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setOffice('');
      setErrors({ fields: {}, message: null });
    }
  }

  const assign = useMutation({
    mutationFn: () => api.assignVehicle(vehicle.id, Number(office)),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: keys.vehicles });
      queryClient.invalidateQueries({ queryKey: keys.offices });
      notify(`${saved.license_plate} moved to ${saved.office_detail.name}`);
      onClose();
    },
    onError: (error) => setErrors(parseApiError(error)),
  });

  const choices = (offices.data ?? []).filter((o) => o.id !== vehicle.office);

  return (
    <Dialog open={open} onClose={assign.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          assign.mutate();
        }}
      >
        <DialogTitle>Assign to another office</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            {vehicle.license_plate} is currently at <strong>{vehicle.office_detail.name}</strong>.
            Its maintenance history moves with it.
          </DialogContentText>
          {errors.message && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errors.message}
            </Alert>
          )}
          <TextField
            select
            fullWidth
            label="New office"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            error={Boolean(errors.fields.office)}
            helperText={errors.fields.office}
            autoFocus
          >
            {choices.map((o) => (
              <MenuItem key={o.id} value={String(o.id)}>
                {o.name} · {o.city}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={assign.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!office} loading={assign.isPending}>
            Move vehicle
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
