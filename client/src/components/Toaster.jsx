import { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import './Toaster.css';

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

const ICONS = {
  success: <CheckIcon />,
  error:   <ErrorIcon />,
  warning: <WarningIcon />,
  info:    <InfoIcon />,
};

function Toast({ toast, onDismiss }) {
  const [leaving, setLeaving] = useState(false);

  function handleClose() {
    setLeaving(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }

  // Also hook into the context dismiss to trigger leave animation
  useEffect(() => {
    return () => {}; // cleanup noop
  }, []);

  return (
    <div
      className={`toast toast-${toast.type}${leaving ? ' toast-leaving' : ''}`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <span className="toast-icon">{ICONS[toast.type]}</span>
      <span className="toast-message">{toast.message}</span>
      <button
        type="button"
        className="toast-close"
        onClick={handleClose}
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
      <div className="toast-progress" />
    </div>
  );
}

export default function Toaster() {
  const { toasts, dismiss } = useToast();

  function handleDismiss(id) {
    dismiss(id);
  }

  if (toasts.length === 0) return null;

  return (
    <div className="toaster" aria-label="Notifications" role="region">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}
