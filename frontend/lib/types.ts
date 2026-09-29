export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type OfficeBrief = { id: number; name: string; city: string };

export type Office = OfficeBrief & { created_at: string; updated_at: string };

export type OfficeSummary = OfficeBrief & {
  active_vehicle_count: number;
  maintenance_cost_last_year: number;
  last_maintenance: string | null;
};

export type Vehicle = {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  office_detail: OfficeBrief;
  active: boolean;
  last_maintenance: string | null;
  created_at: string;
  updated_at: string;
};

export type VehicleInput = Pick<
  Vehicle,
  'vin' | 'license_plate' | 'make' | 'model' | 'year' | 'office' | 'active'
>;

export type MechanicBrief = {
  id: number;
  name: string;
  certification_number: string;
  active: boolean;
};

export type Mechanic = MechanicBrief & { created_at: string; updated_at: string };

export type MechanicInput = Pick<Mechanic, 'name' | 'certification_number' | 'active'>;

export type MechanicWorkload = MechanicBrief & {
  records_this_year: number;
  cost_this_year: number;
};

export type MaintenanceHistoryItem = {
  id: number;
  date: string;
  maintenance_type: string;
  maintenance_type_display: string;
  cost: number;
  notes: string;
  mechanic: MechanicBrief;
};

export type VehicleDetail = Vehicle & {
  maintenance_count: number;
  total_maintenance_cost: number;
  maintenance_records: MaintenanceHistoryItem[];
};

export type MaintenanceRecordInput = {
  vehicle: number;
  mechanic: number;
  date: string;
  maintenance_type: string;
  cost: string;
  notes: string;
};

export type NeedsMaintenanceVehicle = Pick<
  Vehicle,
  'id' | 'vin' | 'license_plate' | 'make' | 'model' | 'year' | 'office' | 'office_detail'
> & {
  last_maintenance: string | null;
  days_since_maintenance: number | null;
};

export type Choice = { value: string; label: string };

export type Facets = { makes: { make: string; models: string[] }[] };

export type DuplicateCheck = { conflicts: ('vin' | 'license_plate')[] };
