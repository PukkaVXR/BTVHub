import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

interface UsePollingQueryOptions<T> {
  query: () => Promise<T>;
  initialData: T;
  intervalMs?: number;
  retryDelayMs?: number;
  enabled?: boolean;
}

interface PollingQueryState<T> {
  data: T;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
  setData: Dispatch<SetStateAction<T>>;
}

export function usePollingQuery<T>({
  query,
  initialData,
  intervalMs,
  retryDelayMs = 2_000,
  enabled = true,
}: UsePollingQueryOptions<T>): PollingQueryState<T> {
  const queryRef = useRef(query);
  const requestRef = useRef<Promise<boolean> | null>(null);
  const requestIdRef = useRef(0);
  const hasLoadedRef = useRef(false);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  queryRef.current = query;

  const execute = useCallback(async (): Promise<boolean> => {
    if (!enabled) return false;
    if (requestRef.current) return requestRef.current;

    const requestId = ++requestIdRef.current;
    setRefreshing(hasLoadedRef.current);
    if (!hasLoadedRef.current) setLoading(true);

    const request = Promise.resolve()
      .then(() => queryRef.current())
      .then((next) => {
        if (requestId !== requestIdRef.current) return false;
        setData(next);
        setError(null);
        hasLoadedRef.current = true;
        return true;
      })
      .catch((err: unknown) => {
        if (requestId !== requestIdRef.current) return false;
        setError(err instanceof Error ? err.message : "Request failed");
        return false;
      })
      .finally(() => {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setRefreshing(false);
          requestRef.current = null;
        }
      });

    requestRef.current = request;
    return request;
  }, [enabled]);

  const refresh = useCallback(async () => {
    await execute();
  }, [execute]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      const ok = await execute();
      if (!active || !intervalMs) return;
      failures = ok ? 0 : failures + 1;
      const delay = ok ? intervalMs : Math.min(intervalMs, retryDelayMs * 2 ** Math.min(failures - 1, 4));
      timer = setTimeout(() => void poll(), delay);
    };

    void poll();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      requestIdRef.current += 1;
      requestRef.current = null;
    };
  }, [enabled, execute, intervalMs, retryDelayMs]);

  return { data, error, loading, refreshing, refresh, setData };
}
