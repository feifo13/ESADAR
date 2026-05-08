import PreviousNextControls from "../PreviousNextControls.jsx";

export default function AdminPagination({
  page,
  totalPages,
  totalItems,
  loading,
  onPrevious,
  onNext,
  className = "",
}) {
  return (
    <div className={["pagination-row", className].filter(Boolean).join(" ")}>
      <span className="muted-copy">
        Pagina {page} de {totalPages} - {totalItems} registros
      </span>

      <PreviousNextControls
        className="table-actions pagination-actions"
        previousClassName="button button-secondary"
        nextClassName="button button-secondary"
        previousDisabled={page === 1 || loading}
        nextDisabled={page >= totalPages || loading}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    </div>
  );
}
