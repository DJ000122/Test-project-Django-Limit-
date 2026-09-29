'use client';

import ClearAllOutlined from '@mui/icons-material/ClearAllOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import {
  Autocomplete,
  Box,
  Button,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useFacets, useMechanicOptions, useOfficeOptions } from '@/lib/queries';
import { useDebounced } from '@/lib/use-debounced';

export const VEHICLE_FILTER_KEYS = [
  'search',
  'office',
  'active',
  'make',
  'model',
  'maintenance_from',
  'maintenance_to',
  'mechanic_certification',
] as const;

export type VehicleFilterKey = (typeof VEHICLE_FILTER_KEYS)[number];
type Values = Record<VehicleFilterKey, string>;

export default function VehicleFilters({
  values,
  onChange,
  onClear,
}: {
  values: Values;
  onChange: (
    changes: Partial<Record<VehicleFilterKey, string | null>>,
    mode?: 'push' | 'replace',
  ) => void;
  onClear: () => void;
}) {
  const offices = useOfficeOptions();
  const mechanics = useMechanicOptions();
  const facets = useFacets();

  // Free-text search is typed locally and pushed to the URL once typing pauses.
  const [search, setSearch] = useState(values.search);
  const debouncedSearch = useDebounced(search, 350);
  // Follow external URL changes (Back button, "Clear filters").
  const [urlSearch, setUrlSearch] = useState(values.search);
  if (urlSearch !== values.search) {
    setUrlSearch(values.search);
    setSearch(values.search);
  }
  useEffect(() => {
    if (debouncedSearch !== values.search) onChange({ search: debouncedSearch }, 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const makes = facets.data?.makes ?? [];
  const models = values.make
    ? (makes.find((m) => m.make.toLowerCase() === values.make.toLowerCase())?.models ?? [])
    : [...new Set(makes.flatMap((m) => m.models))].sort();
  const selectedMechanic =
    (mechanics.data ?? []).find(
      (m) => m.certification_number.toLowerCase() === values.mechanic_certification.toLowerCase(),
    ) ?? null;

  const activeCount = VEHICLE_FILTER_KEYS.filter((k) => values[k]).length;
  const dateRangeInvalid =
    values.maintenance_from &&
    values.maintenance_to &&
    values.maintenance_from > values.maintenance_to;

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, md: 5 }}>
          <TextField
            fullWidth
            placeholder="Search VIN, plate, make or model"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { 'aria-label': 'Search vehicles' },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <TextField
            select
            fullWidth
            label="Office"
            value={values.office}
            onChange={(e) => onChange({ office: e.target.value })}
          >
            <MenuItem value="">All offices</MenuItem>
            {(offices.data ?? []).map((o) => (
              <MenuItem key={o.id} value={String(o.id)}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            fullWidth
            value={values.active}
            onChange={(_, value: string | null) => onChange({ active: value ?? '' })}
            aria-label="Vehicle status"
          >
            <ToggleButton value="">All</ToggleButton>
            <ToggleButton value="true">Active</ToggleButton>
            <ToggleButton value="false">Inactive</ToggleButton>
          </ToggleButtonGroup>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            select
            fullWidth
            label="Make"
            value={makes.some((m) => m.make === values.make) ? values.make : ''}
            onChange={(e) => onChange({ make: e.target.value, model: null })}
          >
            <MenuItem value="">Any make</MenuItem>
            {makes.map((m) => (
              <MenuItem key={m.make} value={m.make}>
                {m.make}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            select
            fullWidth
            label="Model"
            value={models.includes(values.model) ? values.model : ''}
            onChange={(e) => onChange({ model: e.target.value })}
          >
            <MenuItem value="">Any model</MenuItem>
            {models.map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              type="date"
              label="Serviced from"
              value={values.maintenance_from}
              onChange={(e) => onChange({ maintenance_from: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(dateRangeInvalid)}
            />
            <TextField
              fullWidth
              type="date"
              label="Serviced to"
              value={values.maintenance_to}
              onChange={(e) => onChange({ maintenance_to: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
              error={Boolean(dateRangeInvalid)}
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Autocomplete
            options={mechanics.data ?? []}
            value={selectedMechanic}
            onChange={(_, m) => onChange({ mechanic_certification: m?.certification_number ?? '' })}
            getOptionLabel={(m) => `${m.name} (${m.certification_number})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Serviced by mechanic" />
            )}
          />
        </Grid>
      </Grid>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: 1.5,
          minHeight: 32,
        }}
      >
        <Typography variant="body2" color={dateRangeInvalid ? 'error' : 'text.secondary'}>
          {dateRangeInvalid
            ? '"Serviced from" must be on or before "Serviced to".'
            : values.mechanic_certification || values.maintenance_from || values.maintenance_to
              ? 'Service filters match vehicles with at least one record meeting all of them.'
              : ' '}
        </Typography>
        {activeCount > 0 && (
          <Button
            size="small"
            startIcon={<ClearAllOutlined />}
            onClick={() => {
              setSearch('');
              onClear();
            }}
          >
            Clear {activeCount} filter{activeCount > 1 ? 's' : ''}
          </Button>
        )}
      </Box>
    </Paper>
  );
}
