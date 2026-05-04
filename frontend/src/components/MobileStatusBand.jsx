import { useEffect, useState } from 'react';
import { useMobileMenu } from '../contexts/MobileMenuContext.jsx';

function BandIcon({ type }) {
  if (type === 'sort') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 4v16" /><path d="M4 7l3-3 3 3" /><path d="M17 20V4" /><path d="M14 17l3 3 3-3" />
      </svg>
    );
  }
  if (type === 'error') {
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
      <path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" />
    </svg>
  );
}

export default function MobileStatusBand() {
  const { mobileStatusBand, notifyMobileStatus } = useMobileMenu();
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (!mobileStatusBand?.id) return undefined;

    setIsLeaving(false);
    const duration = Math.max(Number(mobileStatusBand.duration || 3000), 1200);
    const leaveTimer = window.setTimeout(() => {
      setIsLeaving(true);
    }, Math.max(0, duration - 520));
    const clearTimer = window.setTimeout(() => {
      notifyMobileStatus({ message: '', duration: 0 });
    }, duration);

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(clearTimer);
    };
  }, [mobileStatusBand?.id, mobileStatusBand?.duration, notifyMobileStatus]);

  if (!mobileStatusBand?.message) return null;

  const type = mobileStatusBand.type === 'error' ? 'error' : mobileStatusBand.type || 'info';

  return (
    <div
      className={`mobile-status-band mobile-status-band--${type}${isLeaving ? ' is-leaving' : ''}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
    >
      <BandIcon type={mobileStatusBand.icon || type} />
      <span>{mobileStatusBand.message}</span>
    </div>
  );
}
