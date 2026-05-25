import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastTone = "info" | "success" | "error";
type ToastInput = string | { message: string; tone?: ToastTone };
type ToastItem = { id: string; message: string; tone: ToastTone };

const ToastContext = createContext<(toast: ToastInput) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((input: ToastInput) => {
    const item = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: typeof input === "string" ? input : input.message,
      tone: typeof input === "string" ? "info" : input.tone ?? "info",
    } satisfies ToastItem;
    setItems((current) => [...current, item].slice(-4));
    setTimeout(() => setItems((current) => current.filter((next) => next.id !== item.id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone}`}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
