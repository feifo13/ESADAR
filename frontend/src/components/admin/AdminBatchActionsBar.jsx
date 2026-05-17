export default function AdminBatchActionsBar({
  selectedCount = 0,
  actions = [],
  busy = false,
  onClear,
}) {
  if (!selectedCount) return null;

  return (
    <div className="admin-batch-actions" role="region" aria-live="polite" aria-label="Acciones batch">
      <div className="admin-batch-actions__track">
        <strong>{selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}</strong>
        <span>Acciones batch solo SUPER_ADMIN</span>
      </div>
      <div className="admin-batch-actions__buttons">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`ghost-button admin-batch-actions__button admin-batch-actions__button--${action.variant || 'default'}`}
            onClick={action.onClick}
            disabled={busy || action.disabled}
          >
            {action.label}
          </button>
        ))}
        <button
          type="button"
          className="ghost-button admin-batch-actions__button admin-batch-actions__button--clear"
          onClick={onClear}
          disabled={busy}
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}
