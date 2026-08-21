export const URUGUAY_COUNTRY = 'Uruguay';

export const URUGUAY_DEPARTMENTS = Object.freeze([
  'Artigas',
  'Canelones',
  'Cerro Largo',
  'Colonia',
  'Durazno',
  'Flores',
  'Florida',
  'Lavalleja',
  'Maldonado',
  'Montevideo',
  'Paysandú',
  'Río Negro',
  'Rivera',
  'Rocha',
  'Salto',
  'San José',
  'Soriano',
  'Tacuarembó',
  'Treinta y Tres',
]);

export const DWELLING_TYPES = Object.freeze({
  HOUSE: 'HOUSE',
  APARTMENT: 'APARTMENT',
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const URUGUAY_MOBILE_PATTERN = /^9\d{7}$/;

export function normalizeWhitespace(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizePersonName(value) {
  return normalizeWhitespace(value);
}

export function isValidRequiredPersonName(value) {
  return Boolean(normalizePersonName(value));
}

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(email) && email.length <= 255 && EMAIL_PATTERN.test(email);
}

export function normalizeUruguayMobile(value) {
  let compact = String(value ?? '').trim().replace(/[\s()-]/g, '');
  if (compact.startsWith('+598')) compact = compact.slice(4);
  if (compact.startsWith('0')) compact = compact.slice(1);
  return compact;
}

export function isValidUruguayMobile(value) {
  return URUGUAY_MOBILE_PATTERN.test(normalizeUruguayMobile(value));
}

export function isUruguayDepartment(value) {
  return URUGUAY_DEPARTMENTS.includes(normalizeWhitespace(value));
}

export function normalizeCustomerAddress(address = {}) {
  const dwellingType = normalizeWhitespace(address?.dwellingType).toUpperCase();
  return {
    label: normalizeWhitespace(address?.label) || null,
    addressLine: normalizeWhitespace(address?.addressLine),
    city: normalizeWhitespace(address?.city),
    state: normalizeWhitespace(address?.state ?? address?.department),
    country: normalizeWhitespace(address?.country) || URUGUAY_COUNTRY,
    postalCode: normalizeWhitespace(address?.postalCode),
    dwellingType,
    apartment: dwellingType === DWELLING_TYPES.APARTMENT
      ? normalizeWhitespace(address?.apartment)
      : null,
    deliveryNotes: normalizeWhitespace(address?.deliveryNotes) || null,
  };
}

function resolveProfileAddress(profile = {}) {
  if (profile?.defaultAddress && typeof profile.defaultAddress === 'object') {
    return profile.defaultAddress;
  }
  if (profile?.address && typeof profile.address === 'object') {
    return profile.address;
  }
  return profile;
}

export function getCustomerProfileValidationIssues(profile = {}) {
  const issues = [];
  const address = normalizeCustomerAddress(resolveProfileAddress(profile));

  if (!isValidRequiredPersonName(profile?.firstName)) {
    issues.push({ field: 'firstName', code: 'REQUIRED', message: 'El nombre es obligatorio.' });
  }
  if (!isValidRequiredPersonName(profile?.lastName)) {
    issues.push({ field: 'lastName', code: 'REQUIRED', message: 'El apellido es obligatorio.' });
  }
  if (!isValidEmail(profile?.email)) {
    issues.push({ field: 'email', code: 'INVALID_EMAIL', message: 'Ingresá un email válido.' });
  }
  if (!isValidUruguayMobile(profile?.phone)) {
    issues.push({ field: 'phone', code: 'INVALID_MOBILE', message: 'Ingresá un celular uruguayo válido.' });
  }
  if (!address.addressLine) {
    issues.push({ field: 'addressLine', code: 'REQUIRED', message: 'La dirección es obligatoria.' });
  }
  if (!address.city) {
    issues.push({ field: 'city', code: 'REQUIRED', message: 'La ciudad es obligatoria.' });
  }
  if (!isUruguayDepartment(address.state)) {
    issues.push({ field: 'state', code: 'INVALID_DEPARTMENT', message: 'Seleccioná un departamento válido.' });
  }
  if (address.country !== URUGUAY_COUNTRY) {
    issues.push({ field: 'country', code: 'INVALID_COUNTRY', message: 'El país debe ser Uruguay.' });
  }
  if (!address.postalCode) {
    issues.push({ field: 'postalCode', code: 'REQUIRED', message: 'El código postal es obligatorio.' });
  }
  if (!Object.values(DWELLING_TYPES).includes(address.dwellingType)) {
    issues.push({ field: 'dwellingType', code: 'INVALID_DWELLING_TYPE', message: 'Seleccioná casa o apartamento.' });
  }
  if (address.dwellingType === DWELLING_TYPES.APARTMENT && !address.apartment) {
    issues.push({ field: 'apartment', code: 'REQUIRED', message: 'El apartamento es obligatorio.' });
  }

  return issues;
}

export function isCustomerProfileComplete(profile = {}) {
  return getCustomerProfileValidationIssues(profile).length === 0;
}

export function formatCustomerAddress(value = {}) {
  const address = normalizeCustomerAddress(resolveProfileAddress(value));
  return [
    address.addressLine,
    address.dwellingType === DWELLING_TYPES.APARTMENT && address.apartment
      ? `Apto. ${address.apartment}`
      : null,
    address.city,
    address.state,
    address.postalCode,
    address.country && address.country !== URUGUAY_COUNTRY ? address.country : null,
  ].filter(Boolean).join(', ');
}
