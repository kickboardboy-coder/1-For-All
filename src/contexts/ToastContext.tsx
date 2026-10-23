import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

type ToastTone = 'success' | 'error';

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const hideMs = 3500;
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = ++idRef.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, hideMs);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-host" aria-live="polite" aria-relevant="additions">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={toast.tone === 'error' ? 'toast toast-error' : 'toast toast-success'}
            role={toast.tone === 'error' ? 'alert' : 'status'}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);

  if (!value) {
    throw new Error('useToast는 ToastProvider 안에서만 사용할 수 있습니다.');
  }

  return value;
}
