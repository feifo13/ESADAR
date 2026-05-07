import { useEffect, useState } from 'react';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';

function SnackbarIcon({ type }) {
  if (type === 'error' || type === 'warning') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 17h.01" />
      </svg>
    );
  }

  if (type === 'success') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 8h.01" /><path d="M11 12h1v5h1" />
    </svg>
  );
}

export default function AppSnackbar() {
  const { mobileStatusBand, notifyMobileStatus } = useMobileMenu();
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!mobileStatusBand?.id) return undefined;

    setIsLeaving(false);
    const duration = Math.max(Number(mobileStatusBand.duration || 3400), 1200);
    const leaveTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, Math.max(0, duration - 260));
    const clearTimer = window.setTimeout(() => {
      notifyMobileStatus({ message: '', duration: 0 });
    }, duration);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(clearTimer);
    };
  }, [mobileStatusBand?.id, mobileStatusBand?.duration, notifyMobileStatus]);

  if (!mobileStatusBand?.message) return null;

  const type = ['success', 'error', 'warning', 'info'].includes(mobileStatusBand.type)
    ? mobileStatusBand.type
    : 'info';

  return (
    <div
      className={`app-snackbar app-snackbar--${type}${isLeaving ? ' is-leaving' : ''}`}
      role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
      aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
    >
      <SnackbarIcon type={mobileStatusBand.icon || type} />
      <span className="app-snackbar__message">{mobileStatusBand.message}</span>
      <button
        type="button"
        className="app-snackbar__close"
        onClick={() => notifyMobileStatus({ message: '', duration: 0 })}
        aria-label="Cerrar aviso"
      >
        x
      </button>
    </div>
  );
}
