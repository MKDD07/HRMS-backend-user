import { Button } from './Button';
import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export function Toast({
  type = 'success', // 'success' | 'error' | 'warning' | 'info'
  title,
  message,
  onClose
}) {
  const iconMap = {
    success: <CheckCircle2 className="toast__icon text-emerald-400" />,
    error: <AlertCircle className="toast__icon text-rose-400" />,
    warning: <AlertTriangle className="toast__icon text-amber-400" />,
    info: <Info className="toast__icon text-sky-400" />
  };

  return (
    <div className={`toast toast--${type}`}>
      {iconMap[type]}
      <div className="toast__content">
        {title && <div className="toast__title">{title}</div>}
        {message && <div className="toast__message">{message}</div>}
      </div>
      {onClose && (
        <Button type="button" className="toast__close" onClick={onClose} aria-label="Dismiss toast" variant="fadeout" wrapContent={false} iconOnly={true} size="sm">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

export function ToastContainer({ children }) {
  return <div className="toast-container">{children}</div>;
}
