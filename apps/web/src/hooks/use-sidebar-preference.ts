'use client';
import { useSyncExternalStore } from 'react';
import { toast } from '@crm/ui';
const key = 'crm-sidebar-collapsed';
let collapsed = false;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  try {
    collapsed = localStorage.getItem(key) === 'true';
  } catch {
    toast.warning('Sua preferência de navegação não pôde ser recuperada.');
  }
  const changed = (event: StorageEvent) => {
    if (event.key === key) {
      collapsed = event.newValue === 'true';
      notify();
    }
  };
  window.addEventListener('storage', changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', changed);
  };
}
function snapshot() {
  return collapsed;
}
function serverSnapshot() {
  return false;
}
export function useSidebarPreference() {
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const toggle = () => {
    collapsed = !collapsed;
    try {
      localStorage.setItem(key, String(collapsed));
    } catch {
      toast.warning('Sua preferência vale nesta sessão, mas não pôde ser salva.');
    }
    notify();
  };
  return { collapsed: value, toggle };
}
