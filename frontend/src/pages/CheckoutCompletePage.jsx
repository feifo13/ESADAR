import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const BURST_COUNT = 18;
const SPARKS_PER_BURST = 10;

function buildBursts() {
  return Array.from({ length: BURST_COUNT }, (_, index) => {
    const top = 12 + (index % 6) * 12 + ((index * 7) % 5);
    const left = 8 + ((index * 17) % 82);
    const delay = (index % 9) * 0.22;
    const duration = 2.6 + (index % 5) * 0.35;
    const hue = [190, 24, 202, 48, 176, 12][index % 6];

    return {
      id: index,
      top,
      left,
      delay,
      duration,
      hue,
      sparks: Array.from({ length: SPARKS_PER_BURST }, (_, sparkIndex) => ({
        id: `${index}-${sparkIndex}`,
        angle: (360 / SPARKS_PER_BURST) * sparkIndex,
        distance: 38 + ((sparkIndex * 9 + index * 5) % 34),
        duration: duration + (sparkIndex % 3) * 0.2,
        delay: delay + sparkIndex * 0.03,
      })),
    };
  });
}

export default function CheckoutCompletePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const orderNumber = location.state?.orderNumber || null;
  const bursts = useMemo(() => buildBursts(), []);

  return (
    <div className="checkout-complete-screen">
      <div className="checkout-fireworks-layer" aria-hidden="true">
        {bursts.map((burst) => (
          <div
            key={burst.id}
            className="checkout-firework-burst"
            style={{
              top: `${burst.top}%`,
              left: `${burst.left}%`,
              '--burst-delay': `${burst.delay}s`,
              '--burst-duration': `${burst.duration}s`,
              '--burst-hue': burst.hue,
            }}
          >
            <span className="checkout-firework-core" />
            {burst.sparks.map((spark) => (
              <span
                key={spark.id}
                className="checkout-firework-spark"
                style={{
                  '--spark-angle': `${spark.angle}deg`,
                  '--spark-distance': `${spark.distance}px`,
                  '--spark-duration': `${spark.duration}s`,
                  '--spark-delay': `${spark.delay}s`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <section className="section-card checkout-complete-card">
        <p className="section-kicker">Orden recibida</p>
        <h1>Muchas gracias por tu compra</h1>
        <p className="checkout-complete-copy">
          Tu orden quedó registrada correctamente. Tienes <strong>24 hs</strong> para completar el pago.
        </p>
        {orderNumber ? (
          <p className="checkout-complete-order">Orden <strong>{orderNumber}</strong></p>
        ) : null}

        <button
          type="button"
          className="button button-primary"
          onClick={() => navigate('/', { replace: true })}
        >
          Aceptar
        </button>
      </section>
    </div>
  );
}
