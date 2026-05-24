export const MOBILE_DEBUG_FLAG_KEYS = [
  "disableFooterRevealMobile",
  "disableVisualViewport",
  "disableFooterCurtainCover",
  "disableCardContentVisibility",
  "pauseTickerMobile",
  "unifyMobileChrome",
  "disableTickerFixedMobile",
  "hideDebugBadge",
];

const DEBUG_STORAGE_KEY = "esadarDebugMobile";
const FLAGS_STORAGE_KEY = "esadarDebugMobileFlags";

const DEBUG_CLASS_MAP = {
  disableFooterRevealMobile: "esadar-debug-disable-footer-reveal-mobile",
  disableVisualViewport: "esadar-debug-disable-visual-viewport",
  disableFooterCurtainCover: "esadar-debug-disable-footer-curtain-cover",
  disableCardContentVisibility: "esadar-debug-disable-card-content-visibility",
  pauseTickerMobile: "esadar-debug-pause-ticker-mobile",
  unifyMobileChrome: "esadar-debug-unify-mobile-chrome",
  disableTickerFixedMobile: "esadar-debug-disable-ticker-fixed-mobile",
};

const DEBUG_CLASSES = [
  "esadar-debug-mobile",
  ...Object.values(DEBUG_CLASS_MAP),
];

function canUseBrowserStorage() {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function parseBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return false;
}

function createDefaultFlags() {
  return MOBILE_DEBUG_FLAG_KEYS.reduce(
    (flags, key) => ({ ...flags, [key]: false }),
    { enabled: false },
  );
}

function normalizeFlags(nextFlags = {}) {
  const flags = createDefaultFlags();
  flags.enabled = Boolean(nextFlags.enabled);

  for (const key of MOBILE_DEBUG_FLAG_KEYS) {
    flags[key] = Boolean(nextFlags[key]);
  }

  return flags;
}

function readStoredFlags() {
  if (!canUseBrowserStorage()) return createDefaultFlags();

  try {
    const storedFlags = JSON.parse(window.localStorage.getItem(FLAGS_STORAGE_KEY) || "{}");
    return normalizeFlags({
      ...storedFlags,
      enabled: window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1",
    });
  } catch {
    return normalizeFlags({
      enabled: window.localStorage.getItem(DEBUG_STORAGE_KEY) === "1",
    });
  }
}

function persistFlags(flags) {
  if (!canUseBrowserStorage()) return;

  try {
    if (!flags.enabled) {
      window.localStorage.removeItem(DEBUG_STORAGE_KEY);
      window.localStorage.removeItem(FLAGS_STORAGE_KEY);
      return;
    }

    const storedFlags = MOBILE_DEBUG_FLAG_KEYS.reduce((result, key) => {
      result[key] = Boolean(flags[key]);
      return result;
    }, {});

    window.localStorage.setItem(DEBUG_STORAGE_KEY, "1");
    window.localStorage.setItem(FLAGS_STORAGE_KEY, JSON.stringify(storedFlags));
  } catch {
    // localStorage may be unavailable in private or restricted contexts.
  }
}

export function clearMobileDebugFlags() {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(FLAGS_STORAGE_KEY);
    window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures; debug flags should never break the app.
  }
}

export function getMobileDebugFlags() {
  return readStoredFlags();
}

export function isMobileDebugEnabled() {
  return getMobileDebugFlags().enabled;
}

export function syncMobileDebugFlagsFromUrl() {
  if (typeof window === "undefined") return createDefaultFlags();

  const params = new URLSearchParams(window.location.search);

  if (parseBoolean(params.get("esadarDebugMobileReset"))) {
    clearMobileDebugFlags();
    return createDefaultFlags();
  }

  const hasDebugParam = params.has("esadarDebugMobile");
  const storedFlags = hasDebugParam ? createDefaultFlags() : readStoredFlags();
  const nextFlags = normalizeFlags(storedFlags);

  if (hasDebugParam) {
    nextFlags.enabled = parseBoolean(params.get("esadarDebugMobile"));
  }

  if (nextFlags.enabled) {
    for (const key of MOBILE_DEBUG_FLAG_KEYS) {
      if (params.has(key)) {
        nextFlags[key] = parseBoolean(params.get(key));
      }
    }
  }

  const normalizedFlags = normalizeFlags(nextFlags);
  persistFlags(normalizedFlags);
  return normalizedFlags;
}

export function applyMobileDebugClasses(rootElement, flags = getMobileDebugFlags()) {
  if (!rootElement?.classList) return normalizeFlags(flags);

  const normalizedFlags = normalizeFlags(flags);
  rootElement.classList.remove(...DEBUG_CLASSES);

  if (!normalizedFlags.enabled) return normalizedFlags;

  rootElement.classList.add("esadar-debug-mobile");

  for (const [key, className] of Object.entries(DEBUG_CLASS_MAP)) {
    if (normalizedFlags[key]) rootElement.classList.add(className);
  }

  return normalizedFlags;
}
