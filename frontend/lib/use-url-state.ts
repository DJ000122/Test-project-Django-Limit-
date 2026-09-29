'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export function useUrlState<K extends string>(keys: readonly K[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const values = useMemo(
    () => Object.fromEntries(keys.map((k) => [k, searchParams.get(k) ?? ''])) as Record<K, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, keys.join(',')],
  );

  const update = useCallback(
    (changes: Partial<Record<K | 'page', string | null>>, mode: 'push' | 'replace' = 'push') => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in changes)) next.delete('page');
      const qs = next.toString();
      router[mode](qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => router.push(pathname, { scroll: false }), [pathname, router]);

  return { values, update, clear };
}
