import { isAxiosError } from 'axios';

export type ApiErrors = { fields: Record<string, string>; message: string | null };

function firstMessage(value: unknown): string {
  if (Array.isArray(value)) return firstMessage(value[0]);
  if (value && typeof value === 'object') return firstMessage(Object.values(value)[0]);
  return String(value ?? '');
}

export function parseApiError(error: unknown): ApiErrors {
  if (!isAxiosError(error)) {
    return {
      fields: {},
      message: error instanceof Error ? error.message : 'Something went wrong.',
    };
  }
  if (!error.response) {
    return {
      fields: {},
      message: 'Cannot reach the API. Is the Django server running on port 8000?',
    };
  }
  const data = error.response.data as unknown;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const fields: Record<string, string> = {};
    let message: string | null = null;
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === 'detail' || key === 'non_field_errors') message = firstMessage(value);
      else fields[key] = firstMessage(value);
    }
    return { fields, message };
  }
  return { fields: {}, message: `Request failed (${error.response.status}).` };
}

export function errorMessage(error: unknown): string {
  const parsed = parseApiError(error);
  return parsed.message ?? Object.values(parsed.fields)[0] ?? 'Something went wrong.';
}
