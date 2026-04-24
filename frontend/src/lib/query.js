export function buildQueryString(values) {
  const params = new URLSearchParams();

  Object.entries(values || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    if (typeof value === 'boolean') {
      params.set(key, value ? 'true' : 'false');
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}
