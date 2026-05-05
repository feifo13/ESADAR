export function normalizeEmail(value) {
  return String(value || '').trim();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

export function getEmailValidationMessage(value, label = 'email') {
  const email = normalizeEmail(value);
  if (!email) return '';
  return isValidEmail(email) ? '' : `Revisa el ${label}: parece no tener un formato válido.`;
}


export function getRequiredValidationMessage(value, label = 'campo') {
  return String(value || '').trim() ? '' : `Completa ${label}.`;
}
export function getMinLengthValidationMessage(value, minLength = 2, label = 'campo') {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length >= minLength ? '' : `Completa ${label} con al menos ${minLength} caracteres.`;
}

function getFirstApiValidationDetail(error) {
  const fieldErrors = error?.payload?.details?.fieldErrors || error?.payload?.details?.field_errors;
  if (!fieldErrors || typeof fieldErrors !== 'object') return '';
  for (const value of Object.values(fieldErrors)) {
    if (Array.isArray(value) && value[0]) return String(value[0]);
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

export function getFriendlyErrorMessage(error, fallback = 'No se pudo completar la acción.') {
  const rawMessage = String(error?.message || '').trim();
  const lowerMessage = rawMessage.toLowerCase();

  if (lowerMessage === 'invalid credentials') {
    return 'Email o password incorrectos.';
  }

  if (lowerMessage === 'user is inactive') {
    return 'El usuario está inactivo.';
  }

  if (lowerMessage === 'validation error') {
    const detail = getFirstApiValidationDetail(error);
    if (detail) {
      const lowerDetail = detail.toLowerCase();
      if (lowerDetail.includes('required')) return 'Falta completar un campo requerido.';
      if (lowerDetail.includes('invalid email')) return 'Revisa el email: parece no tener un formato válido.';
      if (lowerDetail.includes('string must contain at least')) return 'Hay un campo requerido incompleto.';
    }
    return fallback;
  }

  return rawMessage || fallback;
}


export function getRequiredSelectValidationMessage(value, label = 'opcion') {
  return String(value || '').trim() ? '' : `Selecciona ${label}.`;
}

export function getPositiveNumberValidationMessage(value, label = 'valor') {
  const numericValue = Number(value);
  if (String(value ?? '').trim() === '' || !Number.isFinite(numericValue) || numericValue <= 0) {
    return `Ingresa ${label} mayor a 0.`;
  }
  return '';
}

export function getAtLeastOneContactValidationMessage(values = {}, label = 'un medio de contacto') {
  const hasContact = Object.values(values).some((value) => String(value || '').trim());
  return hasContact ? '' : `Deja ${label}.`;
}

export function firstValidationMessage(...messages) {
  return messages.find((message) => Boolean(message)) || '';
}

export function notifyFormStatus(notifyMobileStatus, type, message, options = {}) {
  if (!message || typeof notifyMobileStatus !== 'function') return;
  notifyMobileStatus({
    type,
    icon: options.icon || type,
    message,
    duration: options.duration,
  });
}
