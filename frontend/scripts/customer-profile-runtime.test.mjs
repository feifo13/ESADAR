import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DWELLING_TYPES,
  URUGUAY_DEPARTMENTS,
  getCustomerProfileValidationIssues,
  isCustomerProfileComplete,
} from '../src/shared/customer-profile.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = (relativePath) => readFileSync(resolve(currentDir, relativePath), 'utf8');

const completeProfile = {
  firstName: 'Juan',
  lastName: 'Pérez',
  email: 'juan@gmail.com',
  phone: '099123456',
  defaultAddress: {
    addressLine: 'Av. Italia 1234',
    city: 'Montevideo',
    state: 'Montevideo',
    country: 'Uruguay',
    postalCode: '11600',
    dwellingType: DWELLING_TYPES.HOUSE,
  },
};

test('frontend profile completeness derives Google partial and completed states', () => {
  const firstGoogleLogin = {
    firstName: 'Juan',
    lastName: 'Pérez',
    email: 'juan@gmail.com',
  };
  assert.equal(isCustomerProfileComplete(firstGoogleLogin), false);
  assert.deepEqual(
    getCustomerProfileValidationIssues(firstGoogleLogin).map((issue) => issue.field),
    ['phone', 'addressLine', 'city', 'state', 'postalCode', 'dwellingType'],
  );
  assert.equal(isCustomerProfileComplete(completeProfile), true);
  assert.equal(isCustomerProfileComplete({ ...firstGoogleLogin, lastName: null }), false);
});

test('shared customer fields use one department catalogue and clear hidden apartment state', () => {
  const fieldsSource = source('../src/components/CustomerProfileFields.jsx');
  assert.equal(URUGUAY_DEPARTMENTS.length, 19);
  assert.match(fieldsSource, /URUGUAY_DEPARTMENTS\.map/);
  assert.match(fieldsSource, /value === DWELLING_TYPES\.HOUSE/);
  assert.match(fieldsSource, /nextAddress\.apartment = ''/);
  assert.match(fieldsSource, /dwellingType === DWELLING_TYPES\.APARTMENT/);
  assert.match(fieldsSource, /name="apartment"/);
  assert.match(fieldsSource, /required/);
});

test('register, account, checkout and admin customer edit reuse customer fields', () => {
  for (const relativePath of [
    '../src/pages/RegisterPage.jsx',
    '../src/pages/AccountPage.jsx',
    '../src/pages/CheckoutPage.jsx',
    '../src/pages/admin/AdminUserEditPage.jsx',
  ]) {
    assert.match(source(relativePath), /CustomerProfileFields/);
  }
});

test('authenticated checkout loads, saves inline and reuses the persistent account profile', () => {
  const checkoutSource = source('../src/pages/CheckoutPage.jsx');
  assert.match(checkoutSource, /apiFetch\("\/api\/public\/account\/profile"\)/);
  assert.match(checkoutSource, /method: "PATCH"/);
  assert.match(checkoutSource, /saveAuthenticatedCheckoutProfile/);
  assert.match(checkoutSource, /setAuthenticatedProfile/);
  assert.match(checkoutSource, /profileDirty/);
  assert.match(checkoutSource, /setProfileDirty\(true\)/);
  assert.match(checkoutSource, /CUSTOMER_PROFILE_INCOMPLETE/);
  assert.match(checkoutSource, /navigate\("\/checkout\/comprador"/);
  assert.doesNotMatch(checkoutSource, /navigate\("\/cuenta\/perfil"/);
});

test('guest checkout sends a full structured address', () => {
  const checkoutSource = source('../src/pages/CheckoutPage.jsx');
  assert.match(checkoutSource, /address: guest\.defaultAddress/);
  assert.match(checkoutSource, /validationPrefix="checkout-guest"/);
});
