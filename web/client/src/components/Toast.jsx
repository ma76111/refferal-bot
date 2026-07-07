import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

/**
 * Toast Provider - يجب تغليف التطبيق به
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role="alert"
          >
            <span>{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label="Close notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook لاستخدام Toast
 * @returns {{ showSuccess, showError, showInfo, showWarning }}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');

  return {
    showSuccess: (msg) => ctx.addToast(msg, 'success'),
    showError: (msg) => ctx.addToast(msg, 'error'),
    showInfo: (msg) => ctx.addToast(msg, 'info'),
    showWarning: (msg) => ctx.addToast(msg, 'warning'),
  };
}
