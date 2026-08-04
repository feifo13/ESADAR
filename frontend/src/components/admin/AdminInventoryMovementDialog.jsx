import { useEffect, useState } from "react";
import { useNotification } from "../../contexts/NotificationContext.jsx";
import { getInventoryMovementLimit } from "../../lib/adminInventory.js";
import { apiFetch } from "../../lib/api.js";

const MOVEMENT_CONFIG = {
  sale: {
    title: "Registrar venta manual",
    actionLabel: "Registrar venta",
    busyLabel: "Registrando venta...",
    endpoint: "manual-sale",
    defaultReason: "Venta manual registrada desde administración",
    successMessage: "Venta manual registrada correctamente.",
    fallbackError: "No se pudo registrar la venta manual.",
  },
  return: {
    title: "Registrar devolución",
    actionLabel: "Registrar devolución",
    busyLabel: "Registrando devolución...",
    endpoint: "return",
    defaultReason: "Devolución registrada desde administración",
    successMessage: "Devolución registrada correctamente.",
    fallbackError: "No se pudo registrar la devolución.",
  },
};

export default function AdminInventoryMovementDialog({
  article,
  mode,
  onClose,
  onCompleted,
}) {
  const { notifySuccess, notifyError } = useNotification();
  const config = MOVEMENT_CONFIG[mode];
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQuantity("1");
    setReason("");
  }, [article?.id, mode]);

  useEffect(() => {
    if (!config) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [config, onClose, saving]);

  if (!article || !config) return null;

  const maxQuantity = getInventoryMovementLimit(article, mode);
  const numericQuantity = Number(quantity);
  const isValidQuantity =
    Number.isInteger(numericQuantity) &&
    numericQuantity > 0 &&
    numericQuantity <= maxQuantity;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValidQuantity) {
      notifyError(`La cantidad debe ser un entero entre 1 y ${maxQuantity}.`);
      return;
    }

    try {
      setSaving(true);
      const normalizedReason = String(reason || "").trim();
      const response = await apiFetch(
        `/api/admin/articles/${article.id}/${config.endpoint}`,
        {
          method: "POST",
          body: {
            quantity: numericQuantity,
            reason: normalizedReason || config.defaultReason,
          },
        },
      );
      notifySuccess(config.successMessage);
      onCompleted?.(response.article);
      onClose?.();
    } catch (error) {
      notifyError(error.message || config.fallbackError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop admin-inventory-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose?.();
      }}
    >
      <form
        className="modal-card admin-inventory-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-inventory-dialog-title"
        onSubmit={handleSubmit}
      >
        <div>
          <p className="section-kicker">Inventario</p>
          <h2 id="admin-inventory-dialog-title">{config.title}</h2>
        </div>

        <div className="inline-note admin-inventory-dialog-summary">
          <strong>{article.title}</strong>
          <span>Disponible: {article.quantityAvailable}</span>
          <span>Reservado: {article.quantityReserved}</span>
          <span>Vendido: {article.quantitySold}</span>
        </div>

        <label className="field-group">
          <span>Cantidad</span>
          <input
            className="input"
            type="number"
            min="1"
            max={maxQuantity}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            autoFocus
            required
          />
          <span className="field-helper">Máximo permitido: {maxQuantity}</span>
        </label>

        <label className="field-group">
          <span>Motivo</span>
          <input
            className="input"
            type="text"
            maxLength="255"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={config.defaultReason}
          />
        </label>

        <p className="muted-copy">
          {mode === "sale"
            ? `Se moverán ${isValidQuantity ? numericQuantity : "N"} unidad(es) de disponible a vendido. Las pérdidas no cambiarán.`
            : `Se moverán ${isValidQuantity ? numericQuantity : "N"} unidad(es) de vendido a disponible. Las pérdidas no cambiarán.`}
        </p>

        <div className="toolbar-inline toolbar-inline-end">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={saving || !isValidQuantity}
          >
            {saving ? config.busyLabel : config.actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
