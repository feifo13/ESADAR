export function normalizeSortValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();

  const stringValue = String(value).trim();
  if (!stringValue) return '';

  const numericValue = Number(stringValue.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isNaN(numericValue) && /^-?[\d\s.,]+$/.test(stringValue)) {
    return numericValue;
  }

  const timeValue = Date.parse(stringValue);
  if (!Number.isNaN(timeValue) && /\d{4}-\d{2}-\d{2}|T\d{2}:\d{2}|\d{2}\/\d{2}\/\d{4}/.test(stringValue)) {
    return timeValue;
  }

  return stringValue.toLocaleLowerCase('es');
}

export function compareSortValues(left, right) {
  const normalizedLeft = normalizeSortValue(left);
  const normalizedRight = normalizeSortValue(right);

  if (normalizedLeft === '' && normalizedRight === '') return 0;
  if (normalizedLeft === '') return 1;
  if (normalizedRight === '') return -1;

  if (typeof normalizedLeft === 'number' && typeof normalizedRight === 'number') {
    return normalizedLeft - normalizedRight;
  }

  return String(normalizedLeft).localeCompare(String(normalizedRight), 'es', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function sortRows(rows, sort, accessors = {}) {
  if (!sort?.key) return rows;

  const accessor = accessors[sort.key] || ((row) => row?.[sort.key]);
  const direction = sort.direction === 'desc' ? -1 : 1;

  return [...rows].sort((left, right) => {
    const result = compareSortValues(accessor(left), accessor(right));
    return result * direction;
  });
}

export function getNextSortDirection(sort, key, defaultDirection = 'asc') {
  if (sort?.key !== key) return defaultDirection;
  return sort.direction === 'asc' ? 'desc' : 'asc';
}
