'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import { parseApiError, type ApiErrors } from '@/lib/errors';

export type SimpleField =
  | { name: string; label: string; type?: 'text'; helper?: string; autoFocus?: boolean }
  | { name: string; label: string; type: 'switch' };

type Values = Record<string, string | boolean>;

export default function SimpleFormDialog({
  open,
  title,
  submitLabel,
  fields,
  initial,
  onSubmit,
  onClose,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  fields: SimpleField[];
  initial: Values;
  onSubmit: (values: Values) => Promise<unknown>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [errors, setErrors] = useState<ApiErrors>({ fields: {}, message: null });
  const [pending, setPending] = useState(false);

  // Reset only when the dialog opens (`initial` is a fresh object every render).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setValues(initial);
      setErrors({ fields: {}, message: null });
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (error) {
      setErrors(parseApiError(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="xs" fullWidth>
      <form onSubmit={submit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {errors.message && <Alert severity="error">{errors.message}</Alert>}
            {fields.map((field) =>
              field.type === 'switch' ? (
                <FormControlLabel
                  key={field.name}
                  control={
                    <Switch
                      checked={Boolean(values[field.name])}
                      onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))}
                    />
                  }
                  label={field.label}
                />
              ) : (
                <TextField
                  key={field.name}
                  label={field.label}
                  required
                  fullWidth
                  autoFocus={field.autoFocus}
                  value={String(values[field.name] ?? '')}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [field.name]: e.target.value }));
                    setErrors((er) => ({ ...er, fields: { ...er.fields, [field.name]: '' } }));
                  }}
                  error={Boolean(errors.fields[field.name])}
                  helperText={errors.fields[field.name] || field.helper}
                />
              ),
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={pending}>
            {submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
