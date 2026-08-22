import assert from "node:assert/strict";
import {
  readFileSync,
} from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import test from "node:test";
import {
  fileURLToPath,
} from "node:url";

const currentDir =
  dirname(
    fileURLToPath(import.meta.url),
  );

function source(relativePath) {
  return readFileSync(
    resolve(
      currentDir,
      relativePath,
    ),
    "utf8",
  );
}

const checkoutSource =
  source(
    "../src/pages/CheckoutPage.jsx",
  );

const completeSource =
  source(
    "../src/pages/CheckoutCompletePage.jsx",
  );


test(
  "checkout stores Mercado Pago retry capability only in completion session payload",
  () => {
    assert.match(
      checkoutSource,
      /paymentRetryToken:\s*createdOrder\?\.paymentRetryToken \|\| null/,
    );

    assert.match(
      checkoutSource,
      /sessionStorage\.setItem\(\s*COMPLETE_STORAGE_KEY,\s*JSON\.stringify\(completionPayload\)/s,
    );

    assert.doesNotMatch(
      checkoutSource,
      /state:\s*completionPayload/,
    );

    assert.match(
      checkoutSource,
      /state:\s*\{[\s\S]*orderNumber:[\s\S]*paymentInstructions:[\s\S]*\}/,
    );
  },
);


test(
  "completion retry calls the public retry endpoint for the same order",
  () => {
    assert.match(
      completeSource,
      /\/api\/public\/orders\/\$\{encodeURIComponent\([\s\S]*completedOrder\.orderId[\s\S]*\)\}\/payment\/retry/,
    );

    assert.match(
      completeSource,
      /method:\s*"POST"/,
    );

    assert.match(
      completeSource,
      /retryToken:\s*paymentRetryToken/,
    );

    assert.match(
      completeSource,
      /Number\(response\?\.orderId\)[\s\S]*Number\(completedOrder\.orderId\)/,
    );

    assert.match(
      completeSource,
      /response\?\.orderNumber[\s\S]*completedOrder\.orderNumber/,
    );
  },
);


test(
  "retry replaces payment instructions without creating another order",
  () => {
    assert.match(
      completeSource,
      /setCompletedOrder\(/,
    );

    assert.match(
      completeSource,
      /paymentInstructions:\s*nextPaymentInstructions/,
    );

    assert.doesNotMatch(
      completeSource,
      /apiFetch\(\s*["']\/api\/public\/orders["'][\s\S]*handleRetryMercadoPagoPayment/,
    );
  },
);


test(
  "retry is shown only for retryable unavailable Mercado Pago instructions",
  () => {
    assert.match(
      completeSource,
      /mercadoPagoUnavailable[\s\S]*paymentInstructions\?\.retryable === true/,
    );

    assert.match(
      completeSource,
      /Reintentar pago/,
    );

    assert.match(
      completeSource,
      /disabled=\{retryingPayment\}/,
    );

    assert.match(
      completeSource,
      /Reintentando\.\.\./,
    );
  },
);


test(
  "retry capability remains out of URL and localStorage",
  () => {
    assert.doesNotMatch(
      checkoutSource,
      /URLSearchParams[\s\S]{0,300}paymentRetryToken/,
    );

    assert.doesNotMatch(
      completeSource,
      /URLSearchParams[\s\S]{0,300}retryToken/,
    );

    assert.doesNotMatch(
      checkoutSource,
      /localStorage[\s\S]{0,300}paymentRetryToken/,
    );

    assert.doesNotMatch(
      completeSource,
      /localStorage[\s\S]{0,300}retryToken/,
    );

    assert.doesNotMatch(
      completeSource,
      /console\.(log|info|warn|error)\([\s\S]{0,300}retryToken/,
    );
  },
);


test(
  "successful retry persists refreshed instructions in the same session payload",
  () => {
    assert.match(
      completeSource,
      /sessionStorage\.setItem\(\s*COMPLETE_STORAGE_KEY,\s*JSON\.stringify\([\s\S]*nextCompletedOrder/,
    );

    assert.match(
      completeSource,
      /getFriendlyErrorMessage/,
    );
  },
);
