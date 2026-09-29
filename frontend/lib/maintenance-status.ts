import { todayIso } from './format';

const DAY_MS = 86_400_000;

export function daysSince(isoDate: string | null) {
  if (!isoDate) return null;
  return Math.floor((Date.parse(todayIso()) - Date.parse(isoDate)) / DAY_MS);
}

export function maintenanceStatus(lastMaintenance: string | null, active: boolean) {
  if (!active) return null;
  const days = daysSince(lastMaintenance);
  if (days === null) return { label: 'Never serviced', color: 'error' as const };
  if (days > 365) return { label: 'Overdue', color: 'warning' as const };
  return null;
}
