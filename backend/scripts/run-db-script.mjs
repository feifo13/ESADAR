import 'dotenv/config';

import bcrypt from 'bcryptjs';

import {
  isProductionTarget,
  loadSqlForRunner,
  renderBootstrapAdminCredentials,
  requiresBootstrapAdminCredentials,
  runMysqlScript,
  validateTargetDatabases,
} from './lib/mysql-script-runner.mjs';

function parseArgs(argv) {
  const options = {
    file: null,
    execute: false,
    allowDestructive: false,
    allowProduction: false,
    confirmDb: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--execute') {
      options.execute = true;
    } else if (arg === '--allow-destructive') {
      options.allowDestructive = true;
    } else if (arg === '--allow-production') {
      options.allowProduction = true;
    } else if (arg === '--file') {
      options.file = argv[++index] || null;
    } else if (arg.startsWith('--file=')) {
      options.file = arg.slice('--file='.length);
    } else if (arg === '--confirm-db') {
      options.confirmDb = argv[++index] || null;
    } else if (arg.startsWith('--confirm-db=')) {
      options.confirmDb = arg.slice('--confirm-db='.length);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printUsage() {
  process.stdout.write([
    'Usage:',
    '  npm run db:script -- --file db/migrations/example.sql',
    '  npm run db:script -- --file db/migrations/example.sql --execute --confirm-db <DB_NAME>',
    '',
    'Safeguards:',
    '  no --execute         => dry-run only',
    '  --confirm-db NAME    => required for every execution',
    '  --allow-destructive  => required for destructive SQL',
    '  --allow-production   => additionally required for production',
    '',
  ].join('\n'));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  const dbName = String(process.env.DB_NAME || '').trim();
  const nodeEnv = String(process.env.NODE_ENV || '').trim();

  const loaded = await loadSqlForRunner(options.file);

  const bootstrapCredentialsRequired =
    requiresBootstrapAdminCredentials(loaded.sql);

  validateTargetDatabases(
    loaded.inspection.targetDatabases,
    dbName,
  );

  const production = isProductionTarget({
    nodeEnv,
    dbName,
  });

  const explicitDatabaseTarget =
    loaded.inspection.targetDatabases.length > 0;

  process.stdout.write(
    '===== ESADAR DB SCRIPT RUNNER =====\n',
  );
  process.stdout.write(
    `MODE=${options.execute ? 'EXECUTE' : 'DRY_RUN'}\n`,
  );
  process.stdout.write(
    `FILE=${loaded.relativePath}\n`,
  );
  process.stdout.write(
    `SHA256=${loaded.sha256}\n`,
  );
  process.stdout.write(
    `NODE_ENV=${nodeEnv || 'UNSET'}\n`,
  );
  process.stdout.write(
    `DB_HOST=${String(process.env.DB_HOST || '').trim() || 'UNSET'}\n`,
  );
  process.stdout.write(
    `DB_PORT=${Number(process.env.DB_PORT || 3306)}\n`,
  );
  process.stdout.write(
    `DB_NAME=${dbName || 'UNSET'}\n`,
  );
  process.stdout.write(
    `PRODUCTION_TARGET=${production ? 'YES' : 'NO'}\n`,
  );
  process.stdout.write(
    `DESTRUCTIVE=${loaded.inspection.destructive ? 'YES' : 'NO'}\n`,
  );
  process.stdout.write(
    `BOOTSTRAP_ADMIN_CREDENTIALS_REQUIRED=${
      bootstrapCredentialsRequired ? 'YES' : 'NO'
    }\n`,
  );
  process.stdout.write(
    `EXPLICIT_DB_TARGETS=${
      loaded.inspection.targetDatabases.join(',') || 'NONE'
    }\n`,
  );

  for (const [risk, count] of Object.entries(
    loaded.inspection.risks,
  )) {
    process.stdout.write(
      `RISK_${risk.toUpperCase()}=${count}\n`,
    );
  }

  if (!options.execute) {
    process.stdout.write('RESULT=PASS_DRY_RUN\n');
    return;
  }

  let executionSql = loaded.sql;

  if (bootstrapCredentialsRequired) {
    const bootstrapEmail = String(
      process.env.ESADAR_BOOTSTRAP_ADMIN_EMAIL || '',
    ).trim();

    const bootstrapPassword = String(
      process.env.ESADAR_BOOTSTRAP_ADMIN_PASSWORD || '',
    );

    if (!bootstrapEmail || !bootstrapPassword) {
      throw new Error(
        'Execution blocked: bootstrap admin credentials are required in environment.',
      );
    }

    if (bootstrapPassword.length < 12) {
      throw new Error(
        'Execution blocked: bootstrap admin password must contain at least 12 characters.',
      );
    }

    const bootstrapPasswordHash =
      await bcrypt.hash(bootstrapPassword, 12);

    executionSql = renderBootstrapAdminCredentials(
      loaded.sql,
      {
        email: bootstrapEmail,
        passwordHash: bootstrapPasswordHash,
      },
    );
  }

  if (!dbName) {
    throw new Error(
      'Execution blocked: DB_NAME is required.',
    );
  }

  if (options.confirmDb !== dbName) {
    throw new Error(
      'Execution blocked: --confirm-db must exactly match DB_NAME.',
    );
  }

  if (production && !options.allowProduction) {
    throw new Error(
      'Execution blocked: production target requires --allow-production.',
    );
  }

  if (
    loaded.inspection.destructive
    && !options.allowDestructive
  ) {
    throw new Error(
      'Execution blocked: destructive SQL requires --allow-destructive.',
    );
  }

  await runMysqlScript(
    executionSql,
    {
      selectDatabase: !explicitDatabaseTarget,
    },
  );

  process.stdout.write('RESULT=PASS_EXECUTED\n');
}

main().catch((error) => {
  process.stderr.write(
    `RESULT=FAIL\nERROR=${error.message}\n`,
  );
  process.exitCode = 1;
});
