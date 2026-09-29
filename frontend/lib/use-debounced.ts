'use client';

import { useEffect, useState } from 'react';

export function useDebounced<T>(value: T, delay = 300): T {
  const serialized = JSON.stringify(value);
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(JSON.parse(serialized) as T), delay);
    return () => clearTimeout(t);
  }, [serialized, delay]);
  return debounced;
}
