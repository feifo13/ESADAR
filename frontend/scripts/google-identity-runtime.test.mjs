import assert from 'node:assert/strict';
import test from 'node:test';
import { createGoogleIdentityRuntime } from '../src/lib/googleIdentityRuntime.js';

function createGoogleDouble() {
  const calls = [];
  return {
    calls,
    google: {
      accounts: {
        id: {
          initialize(configuration) {
            calls.push(configuration);
          },
        },
      },
    },
  };
}

test('initializes Google Identity Services only once for the same client ID', () => {
  const runtime = createGoogleIdentityRuntime();
  const { google, calls } = createGoogleDouble();

  assert.equal(runtime.initialize(google, { client_id: 'client.apps.googleusercontent.com' }), true);
  assert.equal(runtime.initialize(google, { client_id: 'client.apps.googleusercontent.com' }), false);
  assert.equal(calls.length, 1);
});

test('routes the Google response to the active consumer without reinitializing', () => {
  const runtime = createGoogleIdentityRuntime();
  const { google, calls } = createGoogleDouble();
  const responses = [];

  runtime.initialize(google, { client_id: 'client.apps.googleusercontent.com' });
  const unregisterFirst = runtime.registerResponseHandler((response) => responses.push(['first', response]));
  calls[0].callback({ credential: 'first-token' });
  unregisterFirst();

  runtime.registerResponseHandler((response) => responses.push(['second', response]));
  calls[0].callback({ credential: 'second-token' });

  assert.deepEqual(responses, [
    ['first', { credential: 'first-token' }],
    ['second', { credential: 'second-token' }],
  ]);
  assert.equal(calls.length, 1);
});

test('rejects a different client ID in the same page runtime', () => {
  const runtime = createGoogleIdentityRuntime();
  const { google } = createGoogleDouble();

  runtime.initialize(google, { client_id: 'client-a.apps.googleusercontent.com' });

  assert.throws(
    () => runtime.initialize(google, { client_id: 'client-b.apps.googleusercontent.com' }),
    /otro Client ID/,
  );
});
