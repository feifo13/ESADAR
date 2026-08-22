export async function copyTextToClipboard(value) {
  const text = String(value ?? "");

  if (!text.trim()) {
    return false;
  }

  if (
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return false;
  }

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the DOM copy fallback.
  }

  let textarea = null;

  try {
    if (!document.body || typeof document.createElement !== "function") {
      return false;
    }

    textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";

    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    if (typeof textarea.setSelectionRange === "function") {
      textarea.setSelectionRange(0, text.length);
    }

    return document.execCommand?.("copy") === true;
  } catch {
    return false;
  } finally {
    if (textarea?.parentNode) {
      textarea.parentNode.removeChild(textarea);
    }
  }
}
