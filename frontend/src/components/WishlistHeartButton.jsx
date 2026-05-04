import { useEffect, useState } from 'react';

function HeartIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={active ? 'wishlist-heart-icon is-active' : 'wishlist-heart-icon'}>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export default function WishlistHeartButton({
  active,
  pending = false,
  onToggle,
  className = '',
  size = 'md',
  labelActive = 'Quitar de guardados',
  labelInactive = 'Guardar articulo',
}) {
  const [bursting, setBursting] = useState(false);

  useEffect(() => {
    if (!bursting) return undefined;
    const timeoutId = window.setTimeout(() => setBursting(false), 520);
    return () => window.clearTimeout(timeoutId);
  }, [bursting]);

  return (
    <button
      type="button"
      className={[
        'wishlist-heart-button',
        `wishlist-heart-button--${size}`,
        active ? 'is-active' : '',
        pending ? 'is-pending' : '',
        bursting ? 'is-bursting' : '',
        className,
      ].filter(Boolean).join(' ')}
      aria-label={active ? labelActive : labelInactive}
      aria-pressed={active}
      data-wishlist-active={active ? 'true' : 'false'}
      disabled={pending}
      onClick={() => {
        setBursting(true);
        onToggle?.();
      }}
    >
      <span className="wishlist-heart-button__spark wishlist-heart-button__spark--one" aria-hidden="true" />
      <span className="wishlist-heart-button__spark wishlist-heart-button__spark--two" aria-hidden="true" />
      <span className="wishlist-heart-button__spark wishlist-heart-button__spark--three" aria-hidden="true" />
      <span className="wishlist-heart-button__spark wishlist-heart-button__spark--four" aria-hidden="true" />
      <HeartIcon active={active} />
    </button>
  );
}
