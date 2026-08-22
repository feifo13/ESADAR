import assert from "node:assert/strict";
import test from "node:test";

import { copyTextToClipboard } from "../src/lib/clipboard.js";

function replaceGlobal(name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);

  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, name, previous);
    } else {
      delete globalThis[name];
    }
  };
}

test("copyTextToClipboard uses the Clipboard API when available", async () => {
  let copiedValue = null;

  const restoreWindow = replaceGlobal("window", {});
  const restoreDocument = replaceGlobal("document", {});
  const restoreNavigator = replaceGlobal("navigator", {
    clipboard: {
      async writeText(value) {
        copiedValue = value;
      },
    },
  });

  try {
    assert.equal(await copyTextToClipboard("ORD-123"), true);
    assert.equal(copiedValue, "ORD-123");
  } finally {
    restoreNavigator();
    restoreDocument();
    restoreWindow();
  }
});

test("copyTextToClipboard falls back to execCommand when Clipboard API fails", async () => {
  let appended = false;
  let removed = false;
  let copied = false;

  const textarea = {
    value: "",
    style: {},
    parentNode: null,
    setAttribute() {},
    focus() {},
    select() {},
    setSelectionRange() {},
  };

  const body = {
    appendChild(node) {
      appended = true;
      node.parentNode = body;
    },
    removeChild(node) {
      removed = true;
      node.parentNode = null;
    },
  };

  const restoreWindow = replaceGlobal("window", {});
  const restoreNavigator = replaceGlobal("navigator", {
    clipboard: {
      async writeText() {
        throw new Error("clipboard denied");
      },
    },
  });
  const restoreDocument = replaceGlobal("document", {
    body,
    createElement() {
      return textarea;
    },
    execCommand(command) {
      copied = command === "copy";
      return copied;
    },
  });

  try {
    assert.equal(await copyTextToClipboard("TRACK-456"), true);
    assert.equal(textarea.value, "TRACK-456");
    assert.equal(appended, true);
    assert.equal(copied, true);
    assert.equal(removed, true);
  } finally {
    restoreDocument();
    restoreNavigator();
    restoreWindow();
  }
});

test("copyTextToClipboard rejects empty or non-browser input safely", async () => {
  assert.equal(await copyTextToClipboard("   "), false);

  const restoreWindow = replaceGlobal("window", undefined);
  const restoreDocument = replaceGlobal("document", undefined);

  try {
    assert.equal(await copyTextToClipboard("ORD-789"), false);
  } finally {
    restoreDocument();
    restoreWindow();
  }
});
