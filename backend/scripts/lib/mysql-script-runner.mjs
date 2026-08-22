import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { realpath, readFile } from 'node:fs/promises';
import {
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const REPO_ROOT = resolve(currentDir, '../../..');

export const ALLOWED_SQL_ROOTS = Object.freeze([
  resolve(REPO_ROOT, 'db/scripts'),
  resolve(REPO_ROOT, 'db/migrations'),
]);

export const BOOTSTRAP_ADMIN_EMAIL_TOKEN =
  '__ESADAR_SUPER_ADMIN_EMAIL_SQL__';

export const BOOTSTRAP_ADMIN_PASSWORD_HASH_TOKEN =
  '__ESADAR_SUPER_ADMIN_PASSWORD_HASH_SQL__';

function isWithin(root, candidate) {
  const rel = relative(root, candidate);

  return (
    rel !== ''
    && rel !== '..'
    && !rel.startsWith(`..${sep}`)
    && !isAbsolute(rel)
  );
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

export function stripSqlComments(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*--.*$/gm, ' ')
    .replace(/^\s*#.*$/gm, ' ');
}

export function inspectSql(sql) {
  const executable = stripSqlComments(sql);

  const risks = {
    dropDatabase: countMatches(
      executable,
      /\bDROP\s+DATABASE\b/gi,
    ),
    dropTable: countMatches(
      executable,
      /\bDROP\s+TABLE\b/gi,
    ),
    truncate: countMatches(
      executable,
      /\bTRUNCATE(?:\s+TABLE)?\b/gi,
    ),
    delete: countMatches(
      executable,
      /\bDELETE\s+FROM\b/gi,
    ),
    alterDrop: countMatches(
      executable,
      /\bALTER\s+TABLE\b[^;]*\bDROP\b/gi,
    ),
    dropObject: countMatches(
      executable,
      /\bDROP\s+(?:VIEW|INDEX|TRIGGER|PROCEDURE|FUNCTION|EVENT)\b/gi,
    ),
  };

  const targetDatabases = new Set();

  const targetRegex =
    /\b(?:USE|CREATE\s+DATABASE(?:\s+IF\s+NOT\s+EXISTS)?|DROP\s+DATABASE(?:\s+IF\s+EXISTS)?)\s+`?([A-Za-z0-9_-]+)`?/gi;

  for (const match of executable.matchAll(targetRegex)) {
    targetDatabases.add(match[1]);
  }

  return {
    risks,
    destructive: Object.values(risks).some((count) => count > 0),
    targetDatabases: [...targetDatabases].sort(),
  };
}

export function sha256Text(text) {
  return createHash('sha256')
    .update(text)
    .digest('hex');
}

export function isProductionTarget({ nodeEnv, dbName }) {
  const env = String(nodeEnv || '')
    .trim()
    .toLowerCase();

  const name = String(dbName || '')
    .trim()
    .toLowerCase();

  const explicitNonProductionDatabase =
    /(?:^|[_-])(sandbox|test|testing|dev|development)(?:$|[_-])/.test(name);

  if (explicitNonProductionDatabase) {
    return false;
  }

  const explicitProductionDatabase =
    /(?:^|[_-])(prod|production)(?:$|[_-])/.test(name);

  if (explicitProductionDatabase) {
    return true;
  }

  return env === 'production';
}

function sqlStringLiteral(value, label) {
  const normalized = String(value || '').trim();

  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`${label} contains control characters.`);
  }

  return `'${normalized.replaceAll("'", "''")}'`;
}

export function requiresBootstrapAdminCredentials(sql) {
  const text = String(sql || '');

  const hasEmailToken =
    text.includes(BOOTSTRAP_ADMIN_EMAIL_TOKEN);

  const hasHashToken =
    text.includes(BOOTSTRAP_ADMIN_PASSWORD_HASH_TOKEN);

  if (hasEmailToken !== hasHashToken) {
    throw new Error(
      'Bootstrap admin credential template is incomplete.',
    );
  }

  return hasEmailToken;
}

export function renderBootstrapAdminCredentials(
  sql,
  {
    email,
    passwordHash,
  },
) {
  const text = String(sql || '');

  if (!requiresBootstrapAdminCredentials(text)) {
    return text;
  }

  const normalizedEmail = String(email || '').trim();
  const normalizedHash = String(passwordHash || '').trim();

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new Error(
      'Bootstrap admin email is invalid.',
    );
  }

  if (
    !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(
      normalizedHash,
    )
  ) {
    throw new Error(
      'Bootstrap admin password hash must be bcrypt.',
    );
  }

  return text
    .replaceAll(
      BOOTSTRAP_ADMIN_EMAIL_TOKEN,
      sqlStringLiteral(
        normalizedEmail,
        'Bootstrap admin email',
      ),
    )
    .replaceAll(
      BOOTSTRAP_ADMIN_PASSWORD_HASH_TOKEN,
      sqlStringLiteral(
        normalizedHash,
        'Bootstrap admin password hash',
      ),
    );
}

export async function resolveAllowedSqlFile(inputPath) {
  if (!inputPath) {
    throw new Error('SQL file is required.');
  }

  const candidate = resolve(REPO_ROOT, inputPath);

  if (extname(candidate).toLowerCase() !== '.sql') {
    throw new Error('Only .sql files are allowed.');
  }

  let actual;

  try {
    actual = await realpath(candidate);
  } catch {
    throw new Error(`SQL file does not exist: ${inputPath}`);
  }

  const allowedRoots = await Promise.all(
    ALLOWED_SQL_ROOTS.map((root) => realpath(root)),
  );

  if (!allowedRoots.some((root) => isWithin(root, actual))) {
    throw new Error(
      'SQL file is outside the allowed db/scripts or db/migrations roots.',
    );
  }

  return actual;
}

export async function loadSqlForRunner(inputPath) {
  const filePath = await resolveAllowedSqlFile(inputPath);
  const sql = await readFile(filePath, 'utf8');

  return {
    filePath,
    relativePath: relative(REPO_ROOT, filePath),
    sql,
    sha256: sha256Text(sql),
    inspection: inspectSql(sql),
  };
}

export function validateTargetDatabases(
  targetDatabases,
  dbName,
) {
  const expected = String(dbName || '').trim();

  if (!expected) {
    throw new Error('DB_NAME is required.');
  }

  const mismatches = targetDatabases.filter(
    (name) => name !== expected,
  );

  if (mismatches.length) {
    throw new Error(
      `SQL targets database(s) different from DB_NAME: ${mismatches.join(', ')}`,
    );
  }
}

function runSqlProcess(
  command,
  args,
  sql,
  {
    env = process.env,
    stdout = process.stdout,
    stderr = process.stderr,
    label = command,
  } = {},
) {
  return new Promise((resolvePromise, rejectPromise) => {
    const processHandle = spawn(
      command,
      args,
      {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      },
    );

    let stderrText = '';

    processHandle.stdout.on('data', (chunk) => {
      stdout?.write(chunk);
    });

    processHandle.stderr.on('data', (chunk) => {
      stderrText += chunk;
      stderr?.write(chunk);
    });

    processHandle.on('error', rejectPromise);

    processHandle.on('close', (code) => {
      if (code === 0) {
        resolvePromise({ code });
        return;
      }

      rejectPromise(
        new Error(
          `${label} exited with ${code}: ${stderrText.trim()}`,
        ),
      );
    });

    processHandle.stdin.end(sql);
  });
}

export function runMysqlScript(
  sql,
  {
    env = process.env,
    selectDatabase = true,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  const host = String(env.DB_HOST || '').trim();
  const user = String(env.DB_USER || '').trim();
  const dbName = String(env.DB_NAME || '').trim();

  if (!host || !user) {
    throw new Error('DB_HOST and DB_USER are required.');
  }

  if (selectDatabase && !dbName) {
    throw new Error(
      'DB_NAME is required when selecting a database.',
    );
  }

  const args = [
    `--host=${host}`,
    `--port=${Number(env.DB_PORT || 3306)}`,
    `--user=${user}`,
    '--default-character-set=utf8mb4',
  ];

  if (selectDatabase) {
    args.push(`--database=${dbName}`);
  }

  return runSqlProcess(
    'mysql',
    args,
    sql,
    {
      env: {
        ...env,
        MYSQL_PWD: env.DB_PASSWORD || '',
      },
      stdout,
      stderr,
      label: 'mysql client',
    },
  );
}

export function runLocalMysqlAdminScript(
  sql,
  {
    env = process.env,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  return runSqlProcess(
    'sudo',
    [
      '-n',
      'mysql',
      '--protocol=socket',
      '--default-character-set=utf8mb4',
    ],
    sql,
    {
      env,
      stdout,
      stderr,
      label: 'local sudo mysql client',
    },
  );
}
