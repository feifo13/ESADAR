import { useEffect } from 'react';

export default function SurfaceModal({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  wide = false,
  className = '',
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        onClose?.();
      }
    }

    window.addEventListener('keydown', handleKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop surface-modal-backdrop" onClick={() => onClose?.()}>
      <div
        className={[
          'dialog-card',
          wide ? 'dialog-card--wide' : '',
          'surface-modal-card',
          className,
        ].filter(Boolean).join(' ')}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="surface-modal-card__header">
          <div className="page-stack-sm">
            {title ? <h3>{title}</h3> : null}
            {description ? <p className="muted-copy">{description}</p> : null}
          </div>

          <button type="button" className="surface-modal-card__close" onClick={() => onClose?.()} aria-label="Cerrar">
            x
          </button>
        </div>

        <div className="surface-modal-card__body">
          {children}
        </div>

        {actions ? <div className="surface-modal-card__footer">{actions}</div> : null}
      </div>
    </div>
  );
}
