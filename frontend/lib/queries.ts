import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, type QueryParams } from './api';

export const keys = {
  offices: ['offices'] as const,
  vehicles: ['vehicles'] as const,
  mechanics: ['mechanics'] as const,
  reference: ['reference'] as const,
};

export const useOfficeOptions = () =>
  useQuery({
    queryKey: [...keys.offices, 'options'],
    queryFn: () => api.offices({ page_size: 200 }),
    select: (data) => data.results,
    staleTime: 60_000,
  });

export const useMechanicOptions = () =>
  useQuery({
    queryKey: [...keys.mechanics, 'options'],
    queryFn: () => api.mechanics({ page_size: 200 }),
    select: (data) => data.results,
    staleTime: 60_000,
  });

export const useMaintenanceTypes = () =>
  useQuery({
    queryKey: [...keys.reference, 'maintenance-types'],
    queryFn: api.maintenanceTypes,
    staleTime: Infinity,
  });

export const useFacets = () =>
  useQuery({
    queryKey: [...keys.vehicles, 'facets'],
    queryFn: api.vehicleFacets,
    staleTime: 60_000,
  });

export const useVehicles = (params: QueryParams) =>
  useQuery({
    queryKey: [...keys.vehicles, 'list', params],
    queryFn: () => api.vehicles(params),
    placeholderData: keepPreviousData,
  });

export const useVehicle = (id: number) =>
  useQuery({
    queryKey: [...keys.vehicles, 'detail', id],
    queryFn: () => api.vehicle(id),
    enabled: Number.isFinite(id),
  });

export const useNeedsMaintenance = (params: QueryParams = {}) =>
  useQuery({
    queryKey: [...keys.vehicles, 'needs-maintenance', params],
    queryFn: () => api.needsMaintenance(params),
    placeholderData: keepPreviousData,
  });

export const useOfficeSummary = () =>
  useQuery({ queryKey: [...keys.offices, 'summary'], queryFn: api.officeSummary });

export const useMechanics = (params: QueryParams) =>
  useQuery({
    queryKey: [...keys.mechanics, 'list', params],
    queryFn: () => api.mechanics(params),
    placeholderData: keepPreviousData,
  });

export const useWorkload = (params: QueryParams = {}) =>
  useQuery({
    queryKey: [...keys.mechanics, 'workload', params],
    queryFn: () => api.mechanicWorkload(params),
    placeholderData: keepPreviousData,
  });
