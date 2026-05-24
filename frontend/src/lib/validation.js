import { scrollElementIntoViewWithSiteChromeOffset } from './siteChromeOffset.js';

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

function getDocumentRoot(root) {
  if (root?.querySelector) return root;
  if (typeof document !== 'undefined') return document;
  return null;
}

function escapeSelectorValue(value) {
  const rawValue = String(value || '');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(rawValue);
  }
  return rawValue.replace(/(["'\\.#:[\],>+~*^$=|\s])/g, '\\$1');
}

function getFocusableValidationElement(element) {
  if (!element) return null;
  if (element.matches?.('input, select, textarea, button, [tabindex]')) return element;
  return element.querySelector?.('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])') || null;
}

export function focusValidationTarget(target, root) {
  const scope = getDocumentRoot(root);
  if (!scope || !target) return false;

  let element = null;

  if (typeof target === 'string') {
    const escapedTarget = escapeSelectorValue(target);
    element = scope.querySelector(
      `[name="${escapedTarget}"], [data-validation-field="${escapedTarget}"], #${escapedTarget}`,
    );
  } else {
    element = target;
  }

  const focusableElement = getFocusableValidationElement(element);
  if (!focusableElement) return false;

  try {
    scrollElementIntoViewWithSiteChromeOffset(focusableElement, {
      behavior: 'smooth',
      includeTicker: true,
      extra: 22,
    });
  } catch (_error) {
    focusableElement.scrollIntoView?.({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  }

  window.setTimeout(() => {
    focusableElement.focus?.({ preventScroll: true });
    focusableElement.classList?.add('input-validation-target');
    window.setTimeout(() => {
      focusableElement.classList?.remove('input-validation-target');
    }, 1500);
  }, 120);

  return true;
}

export function focusFirstInvalidField(root) {
  const scope = getDocumentRoot(root);
  if (!scope) return false;

  const controls = Array.from(
    scope.querySelectorAll?.('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') || [],
  );

  const invalidControl = controls.find((control) => (
    typeof control.checkValidity === 'function' && !control.checkValidity()
  ));

  return invalidControl ? focusValidationTarget(invalidControl, scope) : false;
}

export function focusFieldAfterRender(target, root, delay = 80) {
  if (typeof window === 'undefined') return false;
  window.setTimeout(() => {
    focusValidationTarget(target, root);
  }, delay);
  return true;
}

export function notifyFormStatus(notifyMobileStatus, type, message, options = {}) {
  if (type === 'error') {
    if (options.target) {
      focusValidationTarget(options.target, options.root);
    } else if (options.focusInvalidRoot) {
      focusFirstInvalidField(options.focusInvalidRoot);
    }
  }

  if (!message || typeof notifyMobileStatus !== 'function') return;
  notifyMobileStatus({
    type,
    icon: options.icon || type,
    message,
    duration: options.duration,
  });
}
