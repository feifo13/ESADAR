import { Link } from "react-router-dom";
import {
  buildTickerTargetUrl,
  DEFAULT_SITE_TICKER,
  normalizeSiteTicker,
  resolveTickerBackgroundColor,
} from "../lib/siteTicker.js";

const OFFER_TICKER_GROUPS = Array.from({ length: 2 }, (_, groupIndex) => groupIndex);
const MIN_OFFER_TICKER_ITEMS = 8;

function buildTickerSequence(messages) {
  const sequence = [];
  while (sequence.length < Math.max(MIN_OFFER_TICKER_ITEMS, messages.length)) {
    sequence.push(...messages);
  }
  return sequence;
}

export default function OfferTicker({ className = "", config = DEFAULT_SITE_TICKER }) {
  const ticker = normalizeSiteTicker(config);
  const messages = ticker.messages?.length ? ticker.messages : ticker.text ? [ticker.text] : [];

  if (!ticker.isEnabled || !messages.length) return null;

  const marqueeMessages = buildTickerSequence(messages);
  const accessibleText = messages.join(". ");

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
      aria-label={`${accessibleText}. Ir al catálogo`}
    >
      <span className="hero-offer-ticker__label">{accessibleText}</span>
      <div className="hero-offer-ticker__track" aria-hidden="true">
        {OFFER_TICKER_GROUPS.map((group) => (
          <span className="hero-offer-ticker__group" key={group}>
            {marqueeMessages.map((message, item) => (
              <span key={`${group}-${item}`}>{message}</span>
            ))}
          </span>
        ))}
      </div>
    </Link>
  );
}
