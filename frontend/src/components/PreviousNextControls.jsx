export default function PreviousNextControls({
  className = "",
  previousLabel = "Anterior",
  nextLabel = "Siguiente",
  previousContent,
  nextContent,
  previousClassName = "",
  nextClassName = "",
  previousDisabled = false,
  nextDisabled = false,
  previousHidden = false,
  nextHidden = false,
  previousAriaLabel,
  nextAriaLabel,
  onPrevious,
  onNext,
  nextSlot,
}) {
  const hasCustomNextSlot = nextSlot !== undefined;

  return (
    <div className={className}>
      {previousHidden ? null : (
        <button
          type="button"
          className={previousClassName || undefined}
          onClick={onPrevious}
          disabled={previousDisabled}
          aria-label={previousAriaLabel}
        >
          {previousContent || previousLabel}
        </button>
      )}

      {hasCustomNextSlot
        ? nextSlot
        : nextHidden
          ? null
          : (
            <button
              type="button"
              className={nextClassName || undefined}
              onClick={onNext}
              disabled={nextDisabled}
              aria-label={nextAriaLabel}
            >
              {nextContent || nextLabel}
            </button>
          )}
    </div>
  );
}
