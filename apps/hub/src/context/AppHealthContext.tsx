import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type PreflightInfo } from "../api";

interface AppHealthState {
  preflight: PreflightInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const AppHealthContext = createContext<AppHealthState | null>(null);

export function AppHealthProvider({ children }: { children: ReactNode }) {
  const [preflight, setPreflight] = useState<PreflightInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const next = await api.preflight();
      setPreflight(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load readiness status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, []);

  const value = useMemo(() => ({ preflight, loading, error, refresh }), [preflight, loading, error]);

  return <AppHealthContext.Provider value={value}>{children}</AppHealthContext.Provider>;
}

export function useAppHealth(): AppHealthState {
  const value = useContext(AppHealthContext);
  if (!value) throw new Error("useAppHealth must be used within AppHealthProvider");
  return value;
}
