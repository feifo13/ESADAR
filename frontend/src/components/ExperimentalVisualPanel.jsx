import { useMemo, useState } from 'react';

export default function ExperimentalVisualPanel({ images = [] }) {
  const [open, setOpen] = useState(false);
  const collageImages = useMemo(() => {
    if (!images.length) return [];
    return [...images, ...images, ...images].slice(0, 9);
  }, [images]);

  return (
    <section className="experimental-visual-shell">
      <div className="experimental-visual-shell__controls">
        <button
          type="button"
          className="button button-secondary experimental-visual-shell__toggle"
          onClick={() => setOpen((current) => !current)}
        >
          {open ? 'Ocultar prueba visual' : 'Mostrar prueba visual'}
        </button>
      </div>

      {open ? (
        <div className="experimental-visual-panel">
          {/* Experimental visual component - safe to remove */}
          <div className="experimental-visual-panel__copy">
            <p className="section-kicker">Experimental</p>
            <h2>Laboratorio visual ESADAR</h2>
            <p className="muted-copy">
              Version aproximada inspirada en un scroll visual tipo editorial, encapsulada para poder removerse sin tocar la app.
            </p>
          </div>

          <div className="experimental-visual-panel__grid" aria-hidden="true">
            {collageImages.map((image, index) => (
              <figure key={`${image}-${index}`} className={`experimental-visual-panel__cell experimental-visual-panel__cell--${(index % 3) + 1}`}>
                <img src={image} alt="" loading="lazy" />
              </figure>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
