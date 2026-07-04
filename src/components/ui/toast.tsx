"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

interface ToastData {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastViewportProps {
  toasts: ToastData[];
  onDismiss: (id: number) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-4"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: number) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    const t = setTimeout(() => setVisible(true), 10);
    // Auto-dismiss after 4s
    const dismiss = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(dismiss);
    };
  }, [toast.id, onDismiss]);

  const Icon =
    toast.variant === "success"
      ? CheckCircle2
      : toast.variant === "error"
        ? AlertCircle
        : Info;

  const colorClass =
    toast.variant === "success"
      ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
      : toast.variant === "error"
        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
        : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-all duration-200 ${colorClass} ${
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
    >
      <Icon className="size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          setTimeout(() => onDismiss(toast.id), 200);
        }}
        className="shrink-0 rounded p-1 hover:bg-black/10 dark:hover:bg-white/10"
        aria-label="Dismiss notification"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/**
 * Hook for managing toasts.
 * Usage:
 *   const { toasts, showToast, dismissToast } = useToasts();
 */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (message: string, variant: ToastVariant = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, variant }]);
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  return { toasts, showToast, dismissToast };
}