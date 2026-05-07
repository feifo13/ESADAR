import { useEffect, useState } from 'react';

function useIsMobileViewport(query = '(max-width: 900px)') {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event) => setMatches(event.matches);
    setMatches(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

export default function ResponsiveFilterPanel({
  title = 'Filtros',
  description = '',
  buttonLabel = 'Mostrar filtros',
  applyLabel = 'Aplicar',
  clearLabel = 'Limpiar',
  onApply,
  onClear,
  defaultOpen = false,
  summary = null,
  children,
}) {
  const isMobile = useIsMobileViewport();
  const [desktopOpen, setDesktopOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);

  const actions = (
    <>
      <button
        type="button"
        className="button button-primary"
        onClick={() => {
          onApply?.();
          if (isMobile) setMobileOpen(false);
        }}
      >
        {applyLabel}
      </button>
      {onClear ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => onClear()}
        >
          {clearLabel}
        </button>
      ) : null}
    </>
  );

  if (isMobile) {
    return (
      <>
        <div className="responsive-filter-trigger">
          <button type="button" className="button button-secondary" onClick={() => setMobileOpen(true)}>
            {buttonLabel}
          </button>
          {summary ? <div className="responsive-filter-trigger__summary">{summary}</div> : null}
        </div>

        {mobileOpen ? (
          <section className="responsive-filter-panel responsive-filter-panel--mobile is-open">
            <div className="responsive-filter-panel__toolbar">
              <div className="page-stack-sm">
                <strong>{title}</strong>
                {description ? <p className="muted-copy">{description}</p> : null}
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setMobileOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="responsive-filter-panel__body">
              {children}
            </div>
            <div className="responsive-filter-panel__actions">
              {actions}
            </div>
          </section>
        ) : null}
      </>
    );
  }

  return (
    <section className={desktopOpen ? 'responsive-filter-panel is-open' : 'responsive-filter-panel'}>
      <div className="responsive-filter-panel__toolbar">
        <div className="page-stack-sm">
          <strong>{title}</strong>
          {description ? <p className="muted-copy">{description}</p> : null}
        </div>

        <div className="inline-action-group">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setDesktopOpen((current) => !current)}
          >
            {desktopOpen ? 'Ocultar filtros' : buttonLabel}
          </button>
        </div>
      </div>

      {summary ? <div className="responsive-filter-panel__summary">{summary}</div> : null}

      {desktopOpen ? (
        <>
          <div className="responsive-filter-panel__body">
            {children}
          </div>
          <div className="responsive-filter-panel__actions">
            {actions}
          </div>
        </>
      ) : null}
    </section>
  );
}
