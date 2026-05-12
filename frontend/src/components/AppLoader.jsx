import esadarWordmark from '../assets/esadar-wordmark.webp';

export default function AppLoader({ variant = 'page', label = 'Cargando contenido' }) {
  const safeVariant = ['page', 'inline', 'overlay', 'card'].includes(variant) ? variant : 'page';

  return (
    <div className={`app-loader app-loader--${safeVariant}`} role="status" aria-live="polite" aria-label={label}>
      <img src={esadarWordmark} alt="" className="app-loader__logo" decoding="async" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
