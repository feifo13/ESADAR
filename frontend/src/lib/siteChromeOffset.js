function getVisibleElementHeight(selector) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return 0;
  }

  const element = document.querySelector(selector);
  if (!element) return 0;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return 0;

  const rect = element.getBoundingClientRect();
  if (rect.height <= 0) return 0;

  const intersectsViewport =
    rect.bottom > 0 && rect.top < (window.innerHeight || document.documentElement.clientHeight || 0);
  const participatesInChrome =
    style.position === "fixed" ||
    style.position === "sticky" ||
    element.classList.contains("hero-offer-ticker--sticky") ||
    Math.abs(rect.top) <= 2;

  return intersectsViewport && participatesInChrome ? rect.height : 0;
}

export function getSiteHeaderHeight() {
  return getVisibleElementHeight(".site-header");
}

export function getSiteTickerHeight() {
  return getVisibleElementHeight(".page-offer-ticker.hero-offer-ticker");
}

export function getSiteChromeOffset({ includeTicker = true, extra = 16 } = {}) {
  return Math.ceil(
    getSiteHeaderHeight() +
      (includeTicker ? getSiteTickerHeight() : 0) +
      Math.max(0, Number(extra) || 0),
  );
}

export function scrollElementIntoViewWithSiteChromeOffset(
  element,
  { behavior = "smooth", includeTicker = true, extra = 16, focus = false } = {},
) {
  if (!element || typeof window === "undefined") return false;

  const offset = getSiteChromeOffset({ includeTicker, extra });
  const targetTop = Math.max(
    0,
    element.getBoundingClientRect().top + window.scrollY - offset,
  );

  window.scrollTo({ top: targetTop, behavior });
  if (focus) element.focus?.({ preventScroll: true });
  return true;
}
