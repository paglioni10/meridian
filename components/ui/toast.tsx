"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastAction = { label: string; onAction: () => void };
type Toast = { id: number; message: string; tone: "default" | "alert"; action?: ToastAction };
type ToastApi = (message: string, tone?: Toast["tone"], action?: ToastAction) => void;

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback<ToastApi>((message, tone = "default", action) => {
    setToast({ id: Date.now(), message, tone, action });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.action ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <ToastContext value={show}>
      {children}
      <div aria-live="polite" role="status">
        {toast ? (
          <div key={toast.id} className={cn("toast", toast.tone === "alert" && "toast-alert")}>
            <span>{toast.message}</span>
            {toast.action ? (
              <button
                type="button"
                className="label text-secondary hover:text-danger"
                onClick={() => {
                  toast.action?.onAction();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
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
