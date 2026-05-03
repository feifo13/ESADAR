export default function SortableTh({
  children,
  sortKey,
  sort,
  onSort,
  className = '',
  align = 'left',
}) {
  const active = sort?.key === sortKey;
  const direction = active ? sort.direction : null;
  const ariaSort = active
    ? direction === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  return (
    <th className={className} aria-sort={ariaSort} data-align={align}>
      <button
        type="button"
        className={active ? 'sortable-th-button is-active' : 'sortable-th-button'}
        onClick={() => onSort?.(sortKey)}
      >
        <span>{children}</span>
        <span className="sortable-th-button__indicator" aria-hidden="true">
          {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
}
