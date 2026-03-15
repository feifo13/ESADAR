export function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160);
}

export function uniqueSlug(base) {
  const slug = slugify(base) || 'item';
  const suffix = Date.now().toString(36).slice(-6);
  return `${slug}-${suffix}`;
}
