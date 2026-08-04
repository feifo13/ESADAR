const PRIVILEGED_ROLE_CODES = new Set(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']);

export function isGoogleCustomerEligible(roles = []) {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  return normalizedRoles.includes('CUSTOMER')
    && !normalizedRoles.some((roleCode) => PRIVILEGED_ROLE_CODES.has(roleCode));
}
