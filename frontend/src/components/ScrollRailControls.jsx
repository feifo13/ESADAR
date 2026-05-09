export default function ScrollRailControls({ targetRef, className = "" }) {
  function scrollByDirection(direction) {
    const target = targetRef?.current;
    if (!target) return;

    const distance = Math.max(280, Math.floor(target.clientWidth * 0.82));
    target.scrollBy({ left: direction * distance, behavior: "smooth" });
  }

  return (
    <div className={["scroll-rail-controls", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        className="scroll-rail-button"
        onClick={() => scrollByDirection(-1)}
        aria-label="Ver anteriores"
        title="Ver anteriores"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <button
        type="button"
        className="scroll-rail-button"
        onClick={() => scrollByDirection(1)}
        aria-label="Ver siguientes"
        title="Ver siguientes"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
