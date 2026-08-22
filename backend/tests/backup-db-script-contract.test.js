import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  dirname,
  resolve,
} from "node:path";
import {
  fileURLToPath,
} from "node:url";

const __dirname =
  dirname(
    fileURLToPath(import.meta.url),
  );

test("backup script disables tablespace dumping", () => {
  const source =
    readFileSync(
      resolve(
        __dirname,
        "../scripts/backup-db.mjs",
      ),
      "utf8",
    );

  assert.match(
    source,
    /--no-tablespaces/,
  );
});

test("backup script handles help before runBackup", () => {
  const source =
    readFileSync(
      resolve(
        __dirname,
        "../scripts/backup-db.mjs",
      ),
      "utf8",
    );

  const cliIndex =
    source.indexOf(
      "process.argv.slice(2)",
    );

  const helpIndex =
    source.indexOf(
      "cliArgs.includes('--help')",
    );

  const runIndex =
    source.indexOf(
      "runBackup().catch",
    );

  assert.ok(cliIndex >= 0);
  assert.ok(helpIndex > cliIndex);
  assert.ok(runIndex > helpIndex);
});

test("backup script rejects unknown CLI arguments", () => {
  const source =
    readFileSync(
      resolve(
        __dirname,
        "../scripts/backup-db.mjs",
      ),
      "utf8",
    );

  assert.match(
    source,
    /cliArgs\.length > 0/,
  );

  assert.match(
    source,
    /Argumento no reconocido/,
  );
});

test("repository ignores local backup directory", () => {
  const source =
    readFileSync(
      resolve(
        __dirname,
        "../../.gitignore",
      ),
      "utf8",
    );

  assert.match(
    source,
    /^backups\/$/m,
  );
});
