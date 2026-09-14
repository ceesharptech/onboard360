import React, { createContext, useContext, useState, useCallback } from "react";
import {
  CheckCircle,
  XCircle,
  Warning,
  Info,
  X,
} from "@phosphor-icons/react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string, duration: number = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast("success", title, message, duration),
    [showToast]
  );

  const error = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast("error", title, message, duration),
    [showToast]
  );

  const warning = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast("warning", title, message, duration),
    [showToast]
  );

  const info = useCallback(
    (title: string, message?: string, duration?: number) =>
      showToast("info", title, message, duration),
    [showToast]
  );

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle size={18} weight="fill" className="text-emerald-400 shrink-0 mt-0.5" />;
      case "error":
        return <XCircle size={18} weight="fill" className="text-rose-400 shrink-0 mt-0.5" />;
      case "warning":
        return <Warning size={18} weight="fill" className="text-amber-400 shrink-0 mt-0.5" />;
      case "info":
        return <Info size={18} weight="fill" className="text-blue-400 shrink-0 mt-0.5" />;
    }
  };

  const getBorderColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "border-emerald-500/20";
      case "error":
        return "border-rose-500/20";
      case "warning":
        return "border-amber-500/20";
      case "info":
        return "border-blue-500/20";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast viewport container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none sm:max-w-md"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg bg-[#0f1013]/95 backdrop-blur-md border ${getBorderColor(
              t.type
            )} shadow-2xl text-left transition-all duration-200 animate-in fade-in slide-in-from-bottom-2`}
          >
            {getIcon(t.type)}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-[#f7f8f8] tracking-tight truncate">
                {t.title}
              </div>
              {t.message && (
                <div className="text-[11px] text-[#8a8f98] mt-0.5 leading-relaxed break-words">
                  {t.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-[#5a5e6b] hover:text-[#d0d6e0] transition-colors p-0.5 rounded -mr-1 -mt-0.5 shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
