import { useNotification } from "../contexts/NotificationContext.jsx";
import { copyTextToClipboard } from "../lib/clipboard.js";

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export default function CopyValueButton({
  value,
  ariaLabel = "Copiar",
  title = "Copiar",
  successMessage = "Copiado",
  errorMessage = "No pudimos copiar automáticamente.",
  className = "icon-action-button",
  style = undefined,
  responsiveLabel = null,
  children = null,
  onCopied = null,
}) {
  const { notifyError, notifyInfo } = useNotification();
  const disabled = !String(value ?? "").trim();

  async function handleCopy(event) {
    event.stopPropagation();

    const copied = await copyTextToClipboard(value);

    if (copied) {
      notifyInfo(successMessage);
    } else {
      notifyError(errorMessage);
    }

    if (typeof onCopied === "function") {
      onCopied(copied);
    }
  }

  return (
    <button
      type="button"
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={handleCopy}
    >
      {responsiveLabel ? (
        <>
          <CopyIcon />
          <span className="copy-value-button__responsive-label">
            {responsiveLabel}
          </span>
        </>
      ) : (
        children ?? <CopyIcon />
      )}
    </button>
  );
}
