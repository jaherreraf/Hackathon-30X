import { useCallback, useEffect, useRef, useState } from "react";
import { usePayGuardStore } from "@/store/usePayGuardStore";

/** Calls an api function, and silently refetches whenever the store changes. */
export function useApi<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const ref = useRef(fetcher);
  ref.current = fetcher;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await ref.current());
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    return usePayGuardStore.subscribe(() => load(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: () => load() };
}
