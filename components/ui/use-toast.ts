"use client";

import { useEffect, useState } from "react";

import type { ToastVariant } from "@/components/ui/toast";

// A minimal toast store (subscribe/dispatch) so any component can call `toast(...)`.
export type ToastItem = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  open: boolean;
};

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function toast(input: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}) {
  const id = `toast-${++counter}`;
  toasts = [...toasts, { id, open: true, ...input }];
  emit();
  return id;
}

export function dismissToast(id: string) {
  toasts = toasts.map((t) => (t.id === id ? { ...t, open: false } : t));
  emit();
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return { toasts: items, toast, dismiss: dismissToast, remove: removeToast };
}
