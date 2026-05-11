import { badRequest } from './app-error.js';

export function parsePositiveIntParam(value, label = 'id') {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw badRequest(`${label} invalido.`);
  }

  const numeric = Number(text);
  if (!Number.isSafeInteger(numeric) || numeric <= 0) {
    throw badRequest(`${label} invalido.`);
  }

  return numeric;
}

export function parseSlugOrIdParam(value, label = 'identificador') {
  const text = String(value ?? '').trim();
  if (!text || text.length > 220) {
    throw badRequest(`${label} invalido.`);
  }
  return text;
}
