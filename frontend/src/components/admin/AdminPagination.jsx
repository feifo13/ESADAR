export default function AdminPagination({
  page,
  totalPages,
  totalItems,
  loading,
  onPrevious,
  onNext,
}) {
  return (
    <div className="pagination-row">
      <span className="muted-copy">
        Pagina {page} de {totalPages} - {totalItems} registros
      </span>

      <div className="table-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={onPrevious}
          disabled={page === 1 || loading}
        >
          Anterior
        </button>
        <button
          type="button"
          className="button button-secondary"
          onClick={onNext}
          disabled={page >= totalPages || loading}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
