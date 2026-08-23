import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  REPO_ROOT,
  inspectSql,
  isProductionTarget,
  loadSqlForRunner,
  renderBootstrapAdminCredentials,
  requiresBootstrapAdminCredentials,
  resolveAllowedSqlFile,
  sha256Text,
  validateTargetDatabases,
} from '../scripts/lib/mysql-script-runner.mjs';

test(
  'inspectSql ignores comments and detects destructive SQL',
  () => {
    const inspection = inspectSql(`
      -- DROP DATABASE ignored_comment;
      /* DELETE FROM ignored_comment; */
      USE esadar_sandbox;
      DELETE FROM orders WHERE id = 1;
      ALTER TABLE users DROP COLUMN legacy_value;
    `);

    assert.equal(
      inspection.destructive,
      true,
    );

    assert.equal(
      inspection.risks.dropDatabase,
      0,
    );

    assert.equal(
      inspection.risks.delete,
      1,
    );

    assert.equal(
      inspection.risks.alterDrop,
      1,
    );

    assert.deepEqual(
      inspection.targetDatabases,
      ['esadar_sandbox'],
    );
  },
);

test(
  'production detection uses NODE_ENV or prod-like DB names',
  () => {
    assert.equal(
      isProductionTarget({
        nodeEnv: 'production',
        dbName: 'esadar',
      }),
      true,
    );

    assert.equal(
      isProductionTarget({
        nodeEnv: 'development',
        dbName: 'esadar_production',
      }),
      true,
    );

    assert.equal(
      isProductionTarget({
        nodeEnv: 'development',
        dbName: 'esadar_sandbox',
      }),
      false,
    );

    assert.equal(
      isProductionTarget({
        nodeEnv: 'production',
        dbName: 'esadar_sandbox',
      }),
      false,
    );
  },
);

test(
  'database-target mismatch is rejected',
  () => {
    assert.throws(
      () => validateTargetDatabases(
        ['esadar_sandbox'],
        'esadar_production',
      ),
      /different from DB_NAME/,
    );

    assert.doesNotThrow(
      () => validateTargetDatabases(
        ['esadar_sandbox'],
        'esadar_sandbox',
      ),
    );
  },
);

test(
  'runner accepts SQL under the canonical DB roots',
  async () => {
    const accepted = await resolveAllowedSqlFile(
      'db/scripts/02_vaciado_operativo_sandbox.sql',
    );

    assert.match(
      accepted,
      /db[\\/]scripts[\\/]02_vaciado_operativo_sandbox\.sql$/,
    );

    await assert.rejects(
      () => resolveAllowedSqlFile(
        'backend/package.json',
      ),
      /Only \.sql files/,
    );
  },
);

test(
  'canonical operational reset loads as destructive without bootstrap credentials',
  async () => {
    const loaded = await loadSqlForRunner(
      'db/scripts/02_vaciado_operativo_sandbox.sql',
    );

    assert.equal(loaded.inspection.destructive, true);
    assert.deepEqual(
      loaded.inspection.targetDatabases,
      ['esadar_sandbox'],
    );
    assert.equal(
      requiresBootstrapAdminCredentials(loaded.sql),
      false,
    );
  },
);

function runRunner(args) {
  const env = {
    ...process.env,
    NODE_ENV: 'test',
    DB_HOST: '127.0.0.1',
    DB_USER: 'test',
    DB_NAME: 'esadar_sandbox',
  };

  delete env.ESADAR_BOOTSTRAP_ADMIN_EMAIL;
  delete env.ESADAR_BOOTSTRAP_ADMIN_PASSWORD;

  return spawnSync(
    process.execPath,
    ['backend/scripts/run-db-script.mjs', ...args],
    {
      cwd: REPO_ROOT,
      env,
      encoding: 'utf8',
    },
  );
}

test(
  'canonical operational reset dry-run passes without bootstrap variables',
  () => {
    const result = runRunner([
      '--file',
      'db/scripts/02_vaciado_operativo_sandbox.sql',
    ]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /BOOTSTRAP_ADMIN_CREDENTIALS_REQUIRED=NO/,
    );
    assert.match(result.stdout, /RESULT=PASS_DRY_RUN/);
  },
);

test(
  'canonical execute reaches normal confirmation guard without bootstrap variables',
  () => {
    const result = runRunner([
      '--file',
      'db/scripts/02_vaciado_operativo_sandbox.sql',
      '--execute',
      '--allow-destructive',
    ]);

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /--confirm-db must exactly match DB_NAME/,
    );
    assert.doesNotMatch(
      result.stderr,
      /bootstrap admin credentials are required/i,
    );
  },
);

test(
  'from-scratch script keeps the bootstrap execution guard',
  () => {
    const result = runRunner([
      '--file',
      'db/scripts/01_from_scratch_superadmin_seed.sql',
      '--execute',
      '--allow-destructive',
    ]);

    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /bootstrap admin credentials are required/i,
    );
  },
);

test(
  'sha256Text is stable',
  () => {
    assert.equal(
      sha256Text('ESADAR'),
      '584bd97cae3dabdef0cb4ca0330a241a591dfd53983352044d8162c72f5967b2',
    );
  },
);


test(
  'bootstrap credential template requires both tokens and renders safely',
  () => {
    const template = [
      'SET @email := __ESADAR_SUPER_ADMIN_EMAIL_SQL__;',
      'SET @hash := __ESADAR_SUPER_ADMIN_PASSWORD_HASH_SQL__;',
    ].join('\n');

    assert.equal(
      requiresBootstrapAdminCredentials(template),
      true,
    );

    const rendered = renderBootstrapAdminCredentials(
      template,
      {
        email: "admin.o'connor@example.invalid",
        passwordHash:
          '$2b$10$123456789012345678901u1234567890123456789012345678901',
      },
    );

    assert.equal(
      rendered.includes('__ESADAR_SUPER_ADMIN_'),
      false,
    );

    assert.match(
      rendered,
      /admin\.o''connor@example\.invalid/,
    );

    assert.throws(
      () => requiresBootstrapAdminCredentials(
        'SELECT __ESADAR_SUPER_ADMIN_EMAIL_SQL__;',
      ),
      /template is incomplete/,
    );
  },
);
