const OFFER_TICKER_TEXT = "ACEPTAMOS OFERTAS EN ARTÍCULOS SELECCIONADOS";
const OFFER_TICKER_GROUPS = Array.from({ length: 5 }, (_, groupIndex) => groupIndex);
const OFFER_TICKER_ITEMS = Array.from({ length: 4 }, (_, itemIndex) => itemIndex);

export default function OfferTicker({ className = "" }) {
  return (
    <div
      className={["hero-offer-ticker", className].filter(Boolean).join(" ")}
      aria-label="Aceptamos ofertas"
    >
      <div className="hero-offer-ticker__track" aria-hidden="true">
        {OFFER_TICKER_GROUPS.map((group) => (
          <span className="hero-offer-ticker__group" key={group}>
            {OFFER_TICKER_ITEMS.map((item) => (
              <span key={`${group}-${item}`}>{OFFER_TICKER_TEXT}</span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
