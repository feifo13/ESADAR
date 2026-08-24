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
      /\/api\/public\/orders\/\$\{encodeURIComponent\(orderId\)\}\/payment\/retry/,
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
      /Number\(response\?\.orderId\)\s*===\s*orderId/,
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
      /updateCompletedOrder\(/,
    );

    assert.match(
      completeSource,
      /paymentInstructions:\s*nextPaymentInstructions/,
    );

    assert.doesNotMatch(
      completeSource,
      /apiFetch\(\s*["']\/api\/public\/orders["'][\s\S]*handleMercadoPagoPaymentAction/,
    );
  },
);


test(
  "payment actions require server eligibility and always use the protected click handler",
  () => {
    assert.match(
      completeSource,
      /paymentActionAllowed[\s\S]*completedOrder\?\.paymentActionAllowed === true/,
    );

    assert.match(
      completeSource,
      /presentation\.showRetry/,
    );

    assert.match(
      completeSource,
      /disabled=\{retryingPayment\}/,
    );

    assert.match(
      completeSource,
      /Reintentando\.\.\./,
    );

    assert.doesNotMatch(
      completeSource,
      /href=\{mercadoPagoCheckoutUrl\}/,
    );

    assert.match(
      completeSource,
      /onClick=\{\(\) => void handleMercadoPagoPaymentAction\(\)\}/,
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
      /updateCompletedOrder[\s\S]*sessionStorage\.setItem\([\s\S]*COMPLETE_STORAGE_KEY/,
    );

    assert.match(
      completeSource,
      /getFriendlyErrorMessage/,
    );
  },
);
