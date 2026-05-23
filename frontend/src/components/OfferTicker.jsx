import { Link } from "react-router-dom";
import {
  buildTickerTargetUrl,
  DEFAULT_SITE_TICKER,
  normalizeSiteTicker,
  resolveTickerBackgroundColor,
} from "../lib/siteTicker.js";

const OFFER_TICKER_GROUPS = Array.from({ length: 5 }, (_, groupIndex) => groupIndex);
const OFFER_TICKER_ITEMS = Array.from({ length: 4 }, (_, itemIndex) => itemIndex);

export default function OfferTicker({ className = "", config = DEFAULT_SITE_TICKER }) {
  const ticker = normalizeSiteTicker(config);

  if (!ticker.isEnabled || !ticker.text) return null;

  return (
    <Link
      to={buildTickerTargetUrl(ticker)}
      className={[
        "hero-offer-ticker",
        ticker.isSticky ? "hero-offer-ticker--sticky" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--ticker-background": resolveTickerBackgroundColor(ticker.backgroundColor) }}
      aria-label={`${ticker.text}. Ir al catálogo`}
    >
      <div className="hero-offer-ticker__track" aria-hidden="true">
        {OFFER_TICKER_GROUPS.map((group) => (
          <span className="hero-offer-ticker__group" key={group}>
            {OFFER_TICKER_ITEMS.map((item) => (
              <span key={`${group}-${item}`}>{ticker.text}</span>
            ))}
          </span>
        ))}
      </div>
    </Link>
  );
}
