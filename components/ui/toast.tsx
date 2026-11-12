"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; tone: "default" | "alert" };
type ToastApi = (message: string, tone?: Toast["tone"]) => void;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback<ToastApi>((message, tone = "default") => {
    setToast({ id: Date.now(), message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div aria-live="polite" role="status">
        {toast ? (
          <div key={toast.id} className={cn("toast", toast.tone === "alert" && "toast-alert")}>
            <span>{toast.message}</span>
            <button type="button" className="label hover:text-danger" onClick={() => setToast(null)}>
              Fechar
            </button>
          </div>
        ) : null}
      </div>
    </ToastContext>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa de ToastProvider");
  return ctx;
}
