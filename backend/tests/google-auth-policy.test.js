import assert from 'node:assert/strict';
import test from 'node:test';
import { isGoogleCustomerEligible } from '../src/modules/auth/google-auth-policy.js';

test('allows Google authentication only for customer-only role sets', () => {
  assert.equal(isGoogleCustomerEligible(['CUSTOMER']), true);
  assert.equal(isGoogleCustomerEligible(['CUSTOMER', 'ADMIN']), false);
  assert.equal(isGoogleCustomerEligible(['ADMIN']), false);
  assert.equal(isGoogleCustomerEligible([]), false);
});
