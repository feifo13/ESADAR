import { useEffect } from 'react';
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
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5h16" /><path d="M7 12h10" /><path d="M10 19h4" />
    </svg>
  );
}

export default function MobileStatusBand() {
  const { mobileStatusBand, notifyMobileStatus } = useMobileMenu();

  useEffect(() => {
    if (!mobileStatusBand?.id) return undefined;
    const timeoutId = window.setTimeout(() => {
      notifyMobileStatus({ message: '', duration: 0 });
    }, mobileStatusBand.duration || 3000);
    return () => window.clearTimeout(timeoutId);
  }, [mobileStatusBand?.id]);

  if (!mobileStatusBand?.message) return null;

  return (
    <div className={`mobile-status-band mobile-status-band--${mobileStatusBand.type}`} role="status" aria-live="polite">
      <BandIcon type={mobileStatusBand.icon || mobileStatusBand.type} />
      <span>{mobileStatusBand.message}</span>
    </div>
  );
}
