import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const toast = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
