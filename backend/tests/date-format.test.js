import test from "node:test";
import assert from "node:assert/strict";
import { formatDateTimePartsInTimeZone } from "../src/utils/date-format.js";

test("formats PDF date fields in Uruguay time regardless of server timezone", () => {
  const parts = formatDateTimePartsInTimeZone("2026-05-15T02:30:00.000Z");

  assert.deepEqual(parts, {
    date: "14/05/2026",
    time: "23:30 hs",
  });
});
