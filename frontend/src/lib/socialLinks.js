export const ESADAR_SOCIAL_LINKS = [
  {
    key: "instagram",
    label: "@esadar.uy",
    platformLabel: "Instagram",
    webUrl: "https://www.instagram.com/esadar.uy/",
    appUrl: "instagram://user?username=esadar.uy",
  },
  {
    key: "facebook",
    label: "Esadar Uy",
    platformLabel: "Facebook",
    webUrl: "https://www.facebook.com/people/Esadar-Uy",
    appUrl:
      "fb://facewebmodal/f?href=https%3A%2F%2Fwww.facebook.com%2Fpeople%2FEsadar-Uy",
  },
];

function isModifiedClick(event) {
  return Boolean(
    event?.metaKey || event?.ctrlKey || event?.shiftKey || event?.altKey,
  );
}

function isMobileNavigator() {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";
  const isTouchDevice =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || Number(navigator.maxTouchPoints || 0) > 0);

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    ua,
  ) || (isTouchDevice && /Macintosh/i.test(ua));
}

export function handleMobileSocialLink(event, socialLink) {
  if (
    !socialLink?.appUrl ||
    !socialLink?.webUrl ||
    !isMobileNavigator() ||
    isModifiedClick(event) ||
    event?.button === 1
  ) {
    return;
  }

  event.preventDefault();

  if (typeof window === "undefined") return;

  let didLeavePage = false;
  let fallbackTimer = 0;

  const clearFallback = () => {
    didLeavePage = true;
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") clearFallback();
  };

  window.addEventListener("pagehide", clearFallback, { once: true });
  document.addEventListener("visibilitychange", handleVisibilityChange, {
    once: true,
  });

  fallbackTimer = window.setTimeout(() => {
    window.removeEventListener("pagehide", clearFallback);
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    if (!didLeavePage) {
      window.location.href = socialLink.webUrl;
    }
  }, 900);

  window.location.href = socialLink.appUrl;
}
