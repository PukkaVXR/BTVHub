import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void>,
  options?: { delay?: number; enabled?: boolean },
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef(false);
  const isFirst = useRef(true);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    if (options?.enabled === false) return;
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = false;
      setStatus("saving");
      void onSaveRef
        .current(data)
        .then(() => {
          setStatus("saved");
          setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
        })
        .catch(() => setStatus("error"));
    }, options?.delay ?? 800);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, options?.delay, options?.enabled]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pending.current || status === "saving") {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  return status;
}
