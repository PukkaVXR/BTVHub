import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SaveStatus } from "../hooks/useAutoSave";

export type GlobalSaveStatus = SaveStatus | "dirty";

interface SaveStatusEntry {
  id: string;
  label: string;
  status: GlobalSaveStatus;
}

interface SaveStatusContextValue {
  entries: SaveStatusEntry[];
  register: (entry: SaveStatusEntry) => void;
  unregister: (id: string) => void;
}

const SaveStatusContext = createContext<SaveStatusContextValue | null>(null);

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<SaveStatusEntry[]>([]);

  const register = useCallback((entry: SaveStatusEntry) => {
    setEntries((current) => {
      const existing = current.find((item) => item.id === entry.id);
      if (
        existing &&
        existing.label === entry.label &&
        existing.status === entry.status
      ) {
        return current;
      }

      const others = current.filter((item) => item.id !== entry.id);
      if (entry.status === "idle") {
        return existing ? others : current;
      }
      return [...others, entry];
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setEntries((current) => {
      if (!current.some((entry) => entry.id === id)) return current;
      return current.filter((entry) => entry.id !== id);
    });
  }, []);

  const value = useMemo<SaveStatusContextValue>(
    () => ({
      entries,
      register,
      unregister,
    }),
    [entries, register, unregister],
  );

  return <SaveStatusContext.Provider value={value}>{children}</SaveStatusContext.Provider>;
}

export function useRegisterSaveStatus(id: string, label: string, status: GlobalSaveStatus) {
  const context = useContext(SaveStatusContext);
  const register = context?.register;
  const unregister = context?.unregister;

  useEffect(() => {
    if (!register || !unregister) return undefined;
    register({ id, label, status });
    return () => unregister(id);
  }, [id, label, register, status, unregister]);
}

export function useSaveStatusSummary() {
  const context = useContext(SaveStatusContext);
  const entries = context?.entries ?? [];

  return useMemo(() => {
    const activeEntries = entries.filter((entry) => entry.status !== "idle");
    const status =
      activeEntries.find((entry) => entry.status === "error")?.status ??
      activeEntries.find((entry) => entry.status === "saving")?.status ??
      activeEntries.find((entry) => entry.status === "dirty")?.status ??
      activeEntries.find((entry) => entry.status === "saved")?.status ??
      "idle";

    const labels = activeEntries
      .filter((entry) => entry.status === status)
      .map((entry) => entry.label);

    return {
      status,
      count: activeEntries.length,
      label: labels.length ? labels.slice(0, 2).join(", ") : "",
    };
  }, [entries]);
}
