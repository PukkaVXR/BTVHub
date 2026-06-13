import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api, type PreflightInfo } from "../api";
import { usePollingQuery } from "../hooks/usePollingQuery";

interface AppHealthState {
  preflight: PreflightInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppHealthContext = createContext<AppHealthState | null>(null);

export function AppHealthProvider({ children }: { children: ReactNode }) {
  const { data: preflight, loading, error, refresh } = usePollingQuery<PreflightInfo | null>({
    query: api.preflight,
    initialData: null,
    intervalMs: 15_000,
  });

  const value = useMemo(() => ({ preflight, loading, error, refresh }), [preflight, loading, error, refresh]);

  return <AppHealthContext.Provider value={value}>{children}</AppHealthContext.Provider>;
}

export function useAppHealth(): AppHealthState {
  const value = useContext(AppHealthContext);
  if (!value) throw new Error("useAppHealth must be used within AppHealthProvider");
  return value;
}
