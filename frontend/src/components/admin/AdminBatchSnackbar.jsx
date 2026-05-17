import { createPortal } from "react-dom";
import { XIcon } from "../ActionIcons.jsx";

export default function AdminBatchSnackbar({
  selectedCount = 0,
  actions = [],
  busy = false,
  onClear,
  entityLabel = "elemento",
  entityPluralLabel = "elementos",
}) {
  if (!selectedCount || typeof document === "undefined") return null;

  const visibleEntity = selectedCount === 1 ? entityLabel : entityPluralLabel;

  return createPortal(
    <div
      className={`admin-batch-snackbar${busy ? " is-busy" : ""}`}
      role="region"
      aria-live="polite"
      aria-label="Acciones batch seleccionadas"
    >
      <div className="admin-batch-snackbar__copy">
        <strong>
          {selectedCount} {visibleEntity} en selección
        </strong>
      </div>
      <div className="admin-batch-snackbar__actions">
        {actions.map((action) => {
          const Icon = action.icon;
          const label = busy && action.busyLabel ? action.busyLabel : action.label;

          return (
            <button
              key={action.key}
              type="button"
              className={`admin-batch-snackbar__button admin-batch-snackbar__button--icon admin-batch-snackbar__button--${
                action.variant || "default"
              }`}
              onClick={action.onClick}
              disabled={busy || action.disabled}
              aria-label={label}
              title={label}
            >
              {busy ? (
                <span className="admin-batch-snackbar__spinner" aria-hidden="true" />
              ) : Icon ? (
                <Icon />
              ) : (
                <span className="admin-batch-snackbar__fallback-icon" aria-hidden="true">
                  {String(action.label || "?").trim().charAt(0)}
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="admin-batch-snackbar__button admin-batch-snackbar__button--icon admin-batch-snackbar__button--clear"
          onClick={onClear}
          disabled={busy}
          aria-label="Limpiar selección"
          title="Limpiar selección"
        >
          <XIcon />
        </button>
      </div>
    </div>,
    document.body,
  );
}
