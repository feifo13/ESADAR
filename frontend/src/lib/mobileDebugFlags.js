const DEBUG_ENABLED_KEY = "esadarDebugMobile";
const DEBUG_FLAGS_KEY = "esadarDebugMobileFlags";
const DEBUG_PARAM = "esadarDebugMobile";
const DEBUG_RESET_PARAM = "esadarDebugMobileReset";

export const MOBILE_DEBUG_FLAG_NAMES = [
  "disableFooterRevealMobile",
  "disableVisualViewport",
  "disableFooterCurtainCover",
  "disableCardContentVisibility",
  "pauseTickerMobile",
  "unifyMobileChrome",
  "disableTickerFixedMobile",
  "hideDebugBadge",
];

export const MOBILE_DEBUG_CLASS_NAMES = {
  enabled: "esadar-debug-mobile",
  disableFooterRevealMobile: "esadar-debug-disable-footer-reveal-mobile",
  disableVisualViewport: "esadar-debug-disable-visual-viewport",
  disableFooterCurtainCover: "esadar-debug-disable-footer-curtain-cover",
  disableCardContentVisibility: "esadar-debug-disable-card-content-visibility",
  pauseTickerMobile: "esadar-debug-pause-ticker-mobile",
  unifyMobileChrome: "esadar-debug-unify-mobile-chrome",
  disableTickerFixedMobile: "esadar-debug-disable-ticker-fixed-mobile",
  hideDebugBadge: "esadar-debug-hide-badge",
};

function canUseBrowserStorage() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function safeGetSearchParams() {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return null;
  }
}

function isTruthyDebugValue(value) {
  return value === "" || value === "1" || value === "true" || value === "yes";
}

function createEmptyFlags(enabled = false) {
  return MOBILE_DEBUG_FLAG_NAMES.reduce(
    (flags, flagName) => ({ ...flags, [flagName]: false }),
    { enabled: Boolean(enabled) },
  );
}

function readStoredFlags() {
  const stored = createEmptyFlags(false);
  if (!canUseBrowserStorage()) return stored;

  try {
    stored.enabled = window.localStorage.getItem(DEBUG_ENABLED_KEY) === "1";
    const rawFlags = window.localStorage.getItem(DEBUG_FLAGS_KEY);
    if (!rawFlags) return stored;
    const parsedFlags = JSON.parse(rawFlags);
    MOBILE_DEBUG_FLAG_NAMES.forEach((flagName) => {
      stored[flagName] = parsedFlags?.[flagName] === true;
    });
  } catch {
    return createEmptyFlags(false);
  }

  return stored;
}

function readUrlFlagValues(searchParams) {
  const flags = createEmptyFlags(false);
  if (!searchParams) return flags;

  MOBILE_DEBUG_FLAG_NAMES.forEach((flagName) => {
    if (searchParams.has(flagName)) {
      flags[flagName] = isTruthyDebugValue(searchParams.get(flagName));
    }
  });

  return flags;
}

function persistMobileDebugFlags(flags) {
  if (!canUseBrowserStorage()) return;

  try {
    if (!flags.enabled) {
      clearMobileDebugFlags();
      return;
    }

    window.localStorage.setItem(DEBUG_ENABLED_KEY, "1");
    const persistedFlags = {};
    MOBILE_DEBUG_FLAG_NAMES.forEach((flagName) => {
      persistedFlags[flagName] = flags[flagName] === true;
    });
    window.localStorage.setItem(DEBUG_FLAGS_KEY, JSON.stringify(persistedFlags));
  } catch {
    // Debug storage is optional; the active page can still use URL flags.
  }
}

export function clearMobileDebugFlags() {
  if (!canUseBrowserStorage()) return;

  try {
    window.localStorage.removeItem(DEBUG_FLAGS_KEY);
    window.localStorage.removeItem(DEBUG_ENABLED_KEY);
  } catch {
    // Ignore storage failures; callers will fall back to URL state.
  }
}

export function syncMobileDebugFlagsFromUrl() {
  const searchParams = safeGetSearchParams();
  if (!searchParams) return readStoredFlags();

  if (searchParams.has(DEBUG_RESET_PARAM)) {
    clearMobileDebugFlags();
    return createEmptyFlags(false);
  }

  const storedFlags = readStoredFlags();
  const urlMentionsDebug = searchParams.has(DEBUG_PARAM);
  const urlEnablesDebug =
    urlMentionsDebug && isTruthyDebugValue(searchParams.get(DEBUG_PARAM));
  const urlDisablesDebug =
    urlMentionsDebug && !isTruthyDebugValue(searchParams.get(DEBUG_PARAM));
  const urlMentionsAnyFlag = MOBILE_DEBUG_FLAG_NAMES.some((flagName) =>
    searchParams.has(flagName),
  );

  if (urlDisablesDebug) {
    clearMobileDebugFlags();
    return createEmptyFlags(false);
  }

  if (urlEnablesDebug) {
    const urlFlags = readUrlFlagValues(searchParams);
    const nextFlags = { ...urlFlags, enabled: true };
    persistMobileDebugFlags(nextFlags);
    return nextFlags;
  }

  if (storedFlags.enabled && urlMentionsAnyFlag) {
    const nextFlags = { ...storedFlags, ...readUrlFlagValues(searchParams), enabled: true };
    persistMobileDebugFlags(nextFlags);
    return nextFlags;
  }

  return storedFlags;
}

export function getMobileDebugFlags() {
  const searchParams = safeGetSearchParams();
  if (!searchParams) return readStoredFlags();

  if (searchParams.has(DEBUG_RESET_PARAM)) {
    return createEmptyFlags(false);
  }

  if (
    searchParams.has(DEBUG_PARAM) &&
    isTruthyDebugValue(searchParams.get(DEBUG_PARAM))
  ) {
    return { ...readUrlFlagValues(searchParams), enabled: true };
  }

  if (
    searchParams.has(DEBUG_PARAM) &&
    !isTruthyDebugValue(searchParams.get(DEBUG_PARAM))
  ) {
    return createEmptyFlags(false);
  }

  const storedFlags = readStoredFlags();
  if (!storedFlags.enabled) return storedFlags;

  const urlMentionsAnyFlag = MOBILE_DEBUG_FLAG_NAMES.some((flagName) =>
    searchParams.has(flagName),
  );

  return urlMentionsAnyFlag
    ? { ...storedFlags, ...readUrlFlagValues(searchParams), enabled: true }
    : storedFlags;
}

export function isMobileDebugEnabled() {
  return getMobileDebugFlags().enabled === true;
}

export function getMobileDebugClassNames(flags = getMobileDebugFlags()) {
  const classNames = [];
  if (flags.enabled) classNames.push(MOBILE_DEBUG_CLASS_NAMES.enabled);

  MOBILE_DEBUG_FLAG_NAMES.forEach((flagName) => {
    if (flags.enabled && flags[flagName]) {
      classNames.push(MOBILE_DEBUG_CLASS_NAMES[flagName]);
    }
  });

  return classNames;
}

export function applyMobileDebugClasses(rootElement, flags = getMobileDebugFlags()) {
  if (!rootElement?.classList) return flags;

  const allClassNames = Object.values(MOBILE_DEBUG_CLASS_NAMES);
  rootElement.classList.remove(...allClassNames);
  const nextClassNames = getMobileDebugClassNames(flags);
  if (nextClassNames.length) rootElement.classList.add(...nextClassNames);
  return flags;
}
