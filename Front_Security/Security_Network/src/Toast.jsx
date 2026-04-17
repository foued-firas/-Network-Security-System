import { createContext, useContext, useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, Info
} from 'lucide-react';

/* ── Toast Context ── */
const ToastCtx = createContext(null);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = (msg, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  };

  return (
    <ToastCtx.Provider value={add}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            {t.type === 'success' && <CheckCircle2 size={15} />}
            {t.type === 'error'   && <XCircle       size={15} />}
            {t.type === 'warning' && <AlertTriangle  size={15} />}
            {t.type === 'info'    && <Info           size={15} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
