import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ToastContext = createContext(null);

let _nextId = 1;

const DURATIONS = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((type, message) => {
    const id = _nextId++;
    const duration = DURATIONS[type] ?? 4000;

    setToasts((prev) => {
      // Keep at most 4 visible
      const next = [...prev, { id, type, message }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });

    timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = {
    success: (msg) => addToast('success', msg),
    error:   (msg) => addToast('error',   msg),
    info:    (msg) => addToast('info',    msg),
    warning: (msg) => addToast('warning', msg),
  };

  return (
    <ToastContext.Provider value={{ toasts, dismiss, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
