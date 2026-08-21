import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DWELLING_TYPES,
  URUGUAY_DEPARTMENTS,
  formatCustomerAddress,
  getCustomerProfileValidationIssues,
  isCustomerProfileComplete,
  isUruguayDepartment,
  isValidEmail,
  isValidRequiredPersonName,
  isValidUruguayMobile,
  normalizeEmail,
  normalizeUruguayMobile,
} from '../../frontend/src/shared/customer-profile.js';
import { registerSchema } from '../src/modules/auth/auth.schemas.js';
import { accountProfileUpdateSchema } from '../src/modules/account/account.schemas.js';
import { createOrderSchema } from '../src/modules/orders/orders.schemas.js';
import { assertCompleteOrderProfile } from '../src/modules/orders/orders.service.js';

const houseAddress = {
  addressLine: 'Av. Italia 1234',
  city: 'Montevideo',
  state: 'Montevideo',
  country: 'Uruguay',
  postalCode: '11600',
  dwellingType: DWELLING_TYPES.HOUSE,
  apartment: null,
};

const completeProfile = {
  firstName: 'Ana-María',
  lastName: "D'Angelo",
  email: 'USER+tag@example.com',
  phone: '099123456',
  defaultAddress: houseAddress,
};

test('required person names accept real formats and reject missing values', () => {
  for (const value of [null, '', '   ']) assert.equal(isValidRequiredPersonName(value), false);
  for (const value of ['José', 'Ana María', 'Ana-María', "D'Angelo", 'De León', 'Pérez-García']) {
    assert.equal(isValidRequiredPersonName(value), true);
  }
});

test('email contract validates and normalizes consistently', () => {
  for (const value of [null, '', '   ', 'user@', '@example.com', 'user.example.com']) {
    assert.equal(isValidEmail(value), false);
  }
  for (const value of ['user@example.com', 'user+tag@example.com', 'USER@example.com']) {
    assert.equal(isValidEmail(value), true);
  }
  assert.equal(normalizeEmail(' USER@example.com '), 'user@example.com');
});

test('Uruguay mobile contract accepts supported representations and persists canonical digits', () => {
  for (const value of ['99123456', '099123456', '+598 99 123 456', '099-123-456']) {
    assert.equal(isValidUruguayMobile(value), true);
    assert.equal(normalizeUruguayMobile(value), '99123456');
  }
  for (const value of ['29021234', '9123456', '09912345', 'abcdefgh']) {
    assert.equal(isValidUruguayMobile(value), false);
  }
});

test('Uruguay department catalogue is exact and duplicate-free', () => {
  assert.equal(URUGUAY_DEPARTMENTS.length, 19);
  assert.equal(new Set(URUGUAY_DEPARTMENTS).size, 19);
  for (const value of ['Montevideo', 'Canelones', 'Río Negro', 'Treinta y Tres']) {
    assert.equal(isUruguayDepartment(value), true);
  }
  assert.equal(isUruguayDepartment('Inventado'), false);
  assert.equal(isUruguayDepartment(''), false);
});

test('house and apartment address rules are derived without a persisted flag', () => {
  assert.equal(isCustomerProfileComplete(completeProfile), true);
  assert.equal(isCustomerProfileComplete({
    ...completeProfile,
    defaultAddress: { ...houseAddress, dwellingType: DWELLING_TYPES.APARTMENT, apartment: '502' },
  }), true);
  const missingApartment = {
    ...completeProfile,
    defaultAddress: { ...houseAddress, dwellingType: DWELLING_TYPES.APARTMENT, apartment: '   ' },
  };
  assert.equal(isCustomerProfileComplete(missingApartment), false);
  assert.ok(getCustomerProfileValidationIssues(missingApartment).some((issue) => issue.field === 'apartment'));
  assert.equal(isCustomerProfileComplete({
    ...completeProfile,
    defaultAddress: { ...houseAddress, dwellingType: 'UNKNOWN' },
  }), false);
});

test('address formatter omits empty apartment fragments', () => {
  assert.equal(formatCustomerAddress(houseAddress), 'Av. Italia 1234, Montevideo, Montevideo, 11600');
  assert.equal(
    formatCustomerAddress({ ...houseAddress, dwellingType: 'APARTMENT', apartment: '502' }),
    'Av. Italia 1234, Apto. 502, Montevideo, Montevideo, 11600',
  );
});

test('register and guest checkout schemas enforce the full write contract', () => {
  const registration = registerSchema.parse({
    ...completeProfile,
    address: completeProfile.defaultAddress,
    password: '123456',
  });
  assert.equal(registration.phone, '99123456');
  assert.equal(registration.email, 'user+tag@example.com');
  assert.doesNotThrow(() => registerSchema.parse({
    ...completeProfile,
    address: { ...completeProfile.defaultAddress, dwellingType: 'APARTMENT', apartment: '502' },
    password: '123456',
  }));
  assert.throws(() => registerSchema.parse({
    ...completeProfile, email: 'invalid', address: completeProfile.defaultAddress, password: '123456',
  }));
  assert.throws(() => registerSchema.parse({
    ...completeProfile, phone: '29021234', address: completeProfile.defaultAddress, password: '123456',
  }));
  assert.throws(() => registerSchema.parse({
    ...completeProfile,
    address: { ...completeProfile.defaultAddress, dwellingType: 'APARTMENT', apartment: '' },
    password: '123456',
  }));

  const guestOrder = createOrderSchema.parse({
    paymentMethod: 'BANK_TRANSFER',
    items: [{ articleId: 1 }],
    guest: { ...completeProfile, address: completeProfile.defaultAddress },
  });
  assert.equal(guestOrder.guest.address.apartment, null);

  for (const field of ['firstName', 'lastName', 'email', 'phone']) {
    const invalidGuest = { ...completeProfile, address: completeProfile.defaultAddress };
    delete invalidGuest[field];
    assert.throws(() => createOrderSchema.parse({
      paymentMethod: 'BANK_TRANSFER', items: [{ articleId: 1 }], guest: invalidGuest,
    }));
  }
  for (const field of ['addressLine', 'city', 'state', 'postalCode', 'dwellingType']) {
    const invalidAddress = { ...completeProfile.defaultAddress };
    delete invalidAddress[field];
    assert.throws(() => createOrderSchema.parse({
      paymentMethod: 'BANK_TRANSFER', items: [{ articleId: 1 }],
      guest: { ...completeProfile, address: invalidAddress },
    }));
  }
  for (const invalidGuest of [
    { ...completeProfile, email: 'invalid', address: completeProfile.defaultAddress },
    { ...completeProfile, phone: '29021234', address: completeProfile.defaultAddress },
    { ...completeProfile, address: { ...completeProfile.defaultAddress, state: 'Inventado' } },
    {
      ...completeProfile,
      address: { ...completeProfile.defaultAddress, dwellingType: 'APARTMENT', apartment: null },
    },
  ]) {
    assert.throws(() => createOrderSchema.parse({
      paymentMethod: 'BANK_TRANSFER', items: [{ articleId: 1 }], guest: invalidGuest,
    }));
  }
});

test('account schema requires a complete profile and immutable email is still validated', () => {
  const parsed = accountProfileUpdateSchema.parse(completeProfile);
  assert.equal(parsed.email, 'user+tag@example.com');
  for (const invalidProfile of [
    { ...completeProfile, firstName: '   ' },
    { ...completeProfile, lastName: '' },
    { ...completeProfile, email: 'invalid' },
    { ...completeProfile, phone: '' },
    { ...completeProfile, phone: '29021234' },
    { ...completeProfile, defaultAddress: { ...houseAddress, state: 'Inventado' } },
    { ...completeProfile, defaultAddress: { ...houseAddress, addressLine: '' } },
    {
      ...completeProfile,
      defaultAddress: { ...houseAddress, dwellingType: 'APARTMENT', apartment: '' },
    },
  ]) {
    assert.throws(() => accountProfileUpdateSchema.parse(invalidProfile));
  }
});

test('backend order guard rejects an incomplete authenticated profile with structured fields', () => {
  const incomplete = { firstName: 'Juan', lastName: null, email: 'juan@gmail.com' };
  assert.throws(
    () => assertCompleteOrderProfile(incomplete),
    (error) => error.statusCode === 400
      && error.details?.code === 'CUSTOMER_PROFILE_INCOMPLETE'
      && error.details.fields.includes('lastName')
      && error.details.fields.includes('phone'),
  );
  assert.doesNotThrow(() => assertCompleteOrderProfile(completeProfile));
});
