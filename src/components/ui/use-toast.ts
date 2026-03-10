/**
 * Toast hook and store — global toast notification system
 *
 * Singleton store pattern (no context provider needed).
 * Toasts auto-dismiss after 5 seconds.
 *
 * Usage:
 * ```ts
 * import { toast } from "@/components/ui/use-toast";
 *
 * // Simple
 * toast({ title: "Saved!" });
 *
 * // With description
 * toast({ title: "Campaign created", description: "Your campaign is now live" });
 *
 * // Error
 * toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
 * ```
 */
import { useEffect, useState } from "react";

// ==========================================
// TYPES
// ==========================================

export type ToastVariant = "default" | "destructive";

export interface ToastData {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: React.ReactNode;
  duration?: number;
}

type ToastInput = Omit<ToastData, "id">;

type Listener = () => void;

// ==========================================
// STORE (singleton, no context needed)
// ==========================================

const TOAST_LIMIT = 5;
const DEFAULT_DURATION = 5000;

let toasts: ToastData[] = [];
let listeners: Listener[] = [];
let idCounter = 0;

function emit() {
  listeners.forEach((l) => l());
}

function addToast(input: ToastInput): string {
  const id = String(++idCounter);
  const duration = input.duration ?? DEFAULT_DURATION;

  const newToast: ToastData = { ...input, id };
  toasts = [newToast, ...toasts].slice(0, TOAST_LIMIT);
  emit();

  // Auto dismiss
  if (duration > 0) {
    setTimeout(() => {
      dismissToast(id);
    }, duration);
  }

  return id;
}

function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function dismissAll() {
  toasts = [];
  emit();
}

// ==========================================
// PUBLIC API
// ==========================================

/**
 * Imperative toast function — call from anywhere
 */
export function toast(input: ToastInput): string {
  return addToast(input);
}

/**
 * React hook — subscribe to toast state changes
 * Used by the <Toaster /> component.
 */
export function useToast() {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    toasts,
    toast: addToast,
    dismiss: dismissToast,
    dismissAll,
  };
}
