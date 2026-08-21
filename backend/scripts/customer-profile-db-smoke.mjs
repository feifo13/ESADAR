import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import mysql from 'mysql2/promise';

const SCRATCH_DATABASE = 'esadar_codex_customer_profile_smoke_tmp';
const currentDir = dirname(fileURLToPath(import.meta.url));
const dbHost = String(process.env.DB_HOST || '').trim().toLowerCase();

function runMysqlScript(sql) {
  return new Promise((resolvePromise, rejectPromise) => {
    const mysqlProcess = spawn('mysql', [
      `--host=${process.env.DB_HOST}`,
      `--port=${Number(process.env.DB_PORT || 3306)}`,
      `--user=${process.env.DB_USER}`,
      '--default-character-set=utf8mb4',
    ], {
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
      stdio: ['pipe', 'ignore', 'pipe'],
      windowsHide: true,
    });
    let stderr = '';
    mysqlProcess.stderr.on('data', (chunk) => { stderr += chunk; });
    mysqlProcess.on('error', rejectPromise);
    mysqlProcess.on('close', (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`mysql client exited with ${code}: ${stderr.trim()}`));
    });
    mysqlProcess.stdin.end(sql);
  });
}

if (!['127.0.0.1', 'localhost', '::1'].includes(dbHost)) {
  throw new Error('Customer profile DB smoke refuses to run against a non-local database host.');
}
if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
  throw new Error('Customer profile DB smoke refuses to run in production mode.');
}

const adminConnection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
});

let pool;
try {
  const fromScratchPath = resolve(currentDir, '../../db/scripts/01_from_scratch_superadmin_seed.sql');
  const fromScratchSql = (await readFile(fromScratchPath, 'utf8'))
    .replaceAll('esadar_sandbox', SCRATCH_DATABASE);
  await runMysqlScript(fromScratchSql);

  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = SCRATCH_DATABASE;
  process.env.SMTP_HOST = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASSWORD = '';
  process.env.SMTP_FROM_EMAIL = '';
  process.env.JWT_SECRET ||= 'customer-profile-db-smoke-secret';

  const [{ registerSchema }, { accountProfileUpdateSchema }, { createOrderSchema }, auth, account, orders, db] = await Promise.all([
    import('../src/modules/auth/auth.schemas.js'),
    import('../src/modules/account/account.schemas.js'),
    import('../src/modules/orders/orders.schemas.js'),
    import('../src/modules/auth/auth.service.js'),
    import('../src/modules/account/account.service.js'),
    import('../src/modules/orders/orders.service.js'),
    import('../src/db/pool.js'),
  ]);
  pool = db.pool;

  const auditContext = {
    actorUserId: null,
    actorLabel: 'customer-profile-db-smoke',
    source: 'FRONTEND',
    ipAddress: null,
    userAgent: 'customer-profile-db-smoke',
    publicSiteUrl: 'http://localhost:5173',
  };
  const address = {
    addressLine: 'Av. Italia 1234',
    city: 'Montevideo',
    state: 'Montevideo',
    country: 'Uruguay',
    postalCode: '11600',
    dwellingType: 'HOUSE',
    apartment: null,
    deliveryNotes: 'Portería',
  };
  const registration = registerSchema.parse({
    firstName: 'Ana María',
    lastName: "D'Angelo",
    email: 'PROFILE.SMOKE@example.com',
    phone: '+598 99 123 456',
    password: 'smoke-password',
    address,
  });
  const registered = await auth.registerUser(registration, auditContext);
  assert.equal(registered.user.profileComplete, true);
  await assert.rejects(
    () => auth.registerUser(registration, auditContext),
    (error) => error.statusCode === 400,
  );
  const [duplicateRows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM users WHERE email = 'profile.smoke@example.com'",
  );
  assert.equal(Number(duplicateRows[0].total), 1);

  const initialProfile = await account.getAccountProfile(registered.user.id);
  assert.equal(initialProfile.profileComplete, true);
  assert.equal(initialProfile.email, 'profile.smoke@example.com');
  assert.equal(initialProfile.phone, '99123456');
  assert.equal(initialProfile.defaultAddress.dwellingType, 'HOUSE');

  const updatedProfile = await account.saveAccountProfile(
    registered.user.id,
    accountProfileUpdateSchema.parse({
      ...initialProfile,
      phone: '099 765 432',
      defaultAddress: {
        ...address,
        dwellingType: 'APARTMENT',
        apartment: '502',
      },
    }),
    { ...auditContext, actorUserId: registered.user.id },
  );
  assert.equal(updatedProfile.profileComplete, true);
  assert.equal(updatedProfile.phone, '99765432');
  assert.equal(updatedProfile.defaultAddress.apartment, '502');

  const [[category], [shipping]] = await Promise.all([
    pool.query('SELECT id FROM categories ORDER BY id LIMIT 1').then(([rows]) => rows),
    pool.query('SELECT id FROM shipping_methods WHERE is_active = 1 ORDER BY id LIMIT 1').then(([rows]) => rows),
  ]);
  const [articleInsert] = await pool.execute(
    `INSERT INTO articles (
      internal_code, slug, title, category_id, sale_price, intake_date, status
    ) VALUES ('PROFILE-SMOKE-1', 'profile-smoke-article', 'Artículo smoke', ?, 1200, CURRENT_DATE, 'ACTIVE')`,
    [category.id],
  );
  await pool.execute(
    'INSERT INTO article_inventory (article_id, quantity_total, quantity_available) VALUES (?, 4, 4)',
    [articleInsert.insertId],
  );

  const order = await orders.createOrder(
    createOrderSchema.parse({
      shippingMethodId: shipping.id,
      paymentMethod: 'BANK_TRANSFER',
      items: [{ articleId: articleInsert.insertId, quantity: 1 }],
    }),
    { userId: registered.user.id },
    { ...auditContext, actorUserId: registered.user.id },
  );
  assert.equal(order.customer.email, 'profile.smoke@example.com');
  assert.equal(order.customer.defaultAddress.dwellingType, 'APARTMENT');
  assert.equal(order.customer.defaultAddress.apartment, '502');

  const [snapshotRows] = await pool.execute(
    `SELECT customer_email_snapshot AS email, customer_phone_snapshot AS phone,
            customer_dwelling_type_snapshot AS dwellingType,
            customer_apartment_snapshot AS apartment
     FROM orders WHERE id = ?`,
    [order.id],
  );
  assert.deepEqual(snapshotRows[0], {
    email: 'profile.smoke@example.com',
    phone: '99765432',
    dwellingType: 'APARTMENT',
    apartment: '502',
  });

  const verifiedPartialGoogleIdentity = {
    provider: 'GOOGLE',
    subject: 'google-profile-smoke',
    email: 'partial.google@example.com',
    firstName: 'Google',
    lastName: null,
  };
  const partialGoogleLogin = await auth.loginWithGoogle(
    { credential: 'verified-by-db-smoke' },
    auditContext,
    { verifyCredential: async () => verifiedPartialGoogleIdentity },
  );
  const partialUserId = partialGoogleLogin.user.id;
  assert.equal(partialGoogleLogin.user.profileComplete, false);
  const partialAuthUser = await auth.getCurrentUser(partialUserId);
  assert.equal(partialAuthUser.profileComplete, false);
  assert.equal(partialAuthUser.lastName, null);
  await assert.rejects(
    () => orders.createOrder(
      createOrderSchema.parse({
        shippingMethodId: shipping.id,
        paymentMethod: 'BANK_TRANSFER',
        items: [{ articleId: articleInsert.insertId, quantity: 1 }],
      }),
      { userId: partialUserId },
      { ...auditContext, actorUserId: partialUserId },
    ),
    (error) => error.statusCode === 400
      && error.details?.code === 'CUSTOMER_PROFILE_INCOMPLETE'
      && error.details.fields.includes('lastName'),
  );

  const [ordersAfterRejectedDirectRequest] = await pool.execute('SELECT COUNT(*) AS total FROM orders');
  assert.equal(Number(ordersAfterRejectedDirectRequest[0].total), 1);

  const completedGoogleProfile = await account.saveAccountProfile(
    partialUserId,
    accountProfileUpdateSchema.parse({
      firstName: 'Google',
      lastName: 'Pérez',
      email: 'partial.google@example.com',
      phone: '099111222',
      defaultAddress: address,
    }),
    { ...auditContext, actorUserId: partialUserId },
  );
  assert.equal(completedGoogleProfile.profileComplete, true);
  assert.equal((await auth.getCurrentUser(partialUserId)).profileComplete, true);

  const secondGoogleLogin = await auth.loginWithGoogle(
    { credential: 'verified-by-db-smoke' },
    auditContext,
    { verifyCredential: async () => verifiedPartialGoogleIdentity },
  );
  assert.equal(secondGoogleLogin.user.id, partialUserId);
  assert.equal(secondGoogleLogin.user.profileComplete, true);

  const completedGoogleOrderInput = createOrderSchema.parse({
    shippingMethodId: shipping.id,
    paymentMethod: 'BANK_TRANSFER',
    items: [{ articleId: articleInsert.insertId, quantity: 1 }],
  });
  const firstGoogleOrder = await orders.createOrder(
    completedGoogleOrderInput,
    { userId: partialUserId },
    { ...auditContext, actorUserId: partialUserId },
  );
  assert.equal(firstGoogleOrder.customer.lastName, 'Pérez');

  const reloadedGoogleProfile = await account.getAccountProfile(partialUserId);
  assert.equal(reloadedGoogleProfile.profileComplete, true);
  assert.equal(reloadedGoogleProfile.defaultAddress.addressLine, address.addressLine);
  const secondGoogleOrder = await orders.createOrder(
    completedGoogleOrderInput,
    { userId: partialUserId },
    { ...auditContext, actorUserId: partialUserId },
  );
  assert.equal(secondGoogleOrder.customer.email, 'partial.google@example.com');

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  process.stdout.write('Customer profile DB smoke passed.\n');
} finally {
  if (pool) await pool.end();
  await adminConnection.query(`DROP DATABASE IF EXISTS \`${SCRATCH_DATABASE}\``);
  await adminConnection.end();
}
