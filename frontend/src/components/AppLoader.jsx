import esadarLoaderMark from '../assets/brand/esadar-isotipo-384.webp';

export default function AppLoader({ variant = 'page', label = 'Cargando contenido' }) {
  const safeVariant = ['page', 'inline', 'overlay', 'card'].includes(variant) ? variant : 'page';

  return (
    <div className={`app-loader app-loader--${safeVariant}`} role="status" aria-live="polite" aria-label={label}>
      <img src={esadarLoaderMark} alt="" className="app-loader__logo" decoding="async" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
