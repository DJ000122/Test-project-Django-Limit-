import { apiClient } from './api-client';
import type {
  Choice,
  DuplicateCheck,
  Facets,
  MaintenanceRecordInput,
  Mechanic,
  MechanicInput,
  MechanicWorkload,
  NeedsMaintenanceVehicle,
  Office,
  OfficeSummary,
  Paginated,
  Vehicle,
  VehicleDetail,
  VehicleInput,
} from './types';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function cleanParams(params: QueryParams) {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

const get = async <T>(url: string, params: QueryParams = {}) =>
  (await apiClient.get<T>(url, { params: cleanParams(params) })).data;

export const api = {
  // offices
  offices: (params: QueryParams = {}) => get<Paginated<Office>>('/offices/', params),
  officeSummary: () => get<OfficeSummary[]>('/offices/summary/'),
  createOffice: async (body: Pick<Office, 'name' | 'city'>) =>
    (await apiClient.post<Office>('/offices/', body)).data,
  updateOffice: async (id: number, body: Pick<Office, 'name' | 'city'>) =>
    (await apiClient.put<Office>(`/offices/${id}/`, body)).data,
  deleteOffice: (id: number) => apiClient.delete(`/offices/${id}/`),

  // vehicles
  vehicles: (params: QueryParams) => get<Paginated<Vehicle>>('/vehicles/', params),
  vehicle: (id: number) => get<VehicleDetail>(`/vehicles/${id}/`),
  vehicleFacets: () => get<Facets>('/vehicles/facets/'),
  needsMaintenance: (params: QueryParams = {}) =>
    get<Paginated<NeedsMaintenanceVehicle>>('/vehicles/needs-maintenance/', params),
  checkDuplicate: (params: {
    vin: string;
    license_plate: string;
    exclude?: number;
    active?: boolean;
  }) => get<DuplicateCheck>('/vehicles/check-duplicate/', params),
  createVehicle: async (body: VehicleInput) =>
    (await apiClient.post<Vehicle>('/vehicles/', body)).data,
  updateVehicle: async (id: number, body: Partial<VehicleInput>) =>
    (await apiClient.patch<Vehicle>(`/vehicles/${id}/`, body)).data,
  deleteVehicle: (id: number) => apiClient.delete(`/vehicles/${id}/`),
  assignVehicle: async (id: number, office: number) =>
    (await apiClient.post<Vehicle>(`/vehicles/${id}/assign/`, { office })).data,

  // mechanics
  mechanics: (params: QueryParams = {}) => get<Paginated<Mechanic>>('/mechanics/', params),
  mechanicWorkload: (params: QueryParams = {}) =>
    get<Paginated<MechanicWorkload>>('/mechanics/workload/', params),
  createMechanic: async (body: MechanicInput) =>
    (await apiClient.post<Mechanic>('/mechanics/', body)).data,
  updateMechanic: async (id: number, body: Partial<MechanicInput>) =>
    (await apiClient.patch<Mechanic>(`/mechanics/${id}/`, body)).data,
  deleteMechanic: (id: number) => apiClient.delete(`/mechanics/${id}/`),

  // maintenance records
  maintenanceTypes: () => get<Choice[]>('/maintenance-types/'),
  createRecord: async (body: MaintenanceRecordInput) =>
    (await apiClient.post('/maintenance-records/', body)).data,
  updateRecord: async (id: number, body: MaintenanceRecordInput) =>
    (await apiClient.put(`/maintenance-records/${id}/`, body)).data,
  deleteRecord: (id: number) => apiClient.delete(`/maintenance-records/${id}/`),
};
