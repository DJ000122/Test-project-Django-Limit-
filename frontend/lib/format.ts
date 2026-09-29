const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const formatCurrency = (value: number | null | undefined) => currency.format(value ?? 0);

export const formatDate = (value: string | null | undefined, fallback = '–') =>
  value ? dateFmt.format(new Date(`${value}T00:00:00Z`)) : fallback;

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
