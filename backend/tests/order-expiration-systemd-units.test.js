import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const systemdDirectory = path.resolve(testDirectory, '../../ops/systemd');
const serviceName = 'esadar-expire-reservations@.service';
const timerName = 'esadar-expire-reservations@.timer';

const [serviceUnit, timerUnit] = await Promise.all([
  readFile(path.join(systemdDirectory, serviceName), 'utf8'),
  readFile(path.join(systemdDirectory, timerName), 'utf8'),
]);
const allUnits = `${serviceUnit}\n${timerUnit}`;

test('UNIT-01 exactly the canonical service and timer templates exist', async () => {
  const unitNames = (await readdir(systemdDirectory))
    .filter((name) => /\.(?:service|timer)$/.test(name))
    .sort();

  assert.deepEqual(unitNames, [serviceName, timerName].sort());
});

test('UNIT-02 service is Type=oneshot', () => {
  assert.match(serviceUnit, /^Type=oneshot$/m);
});

test('UNIT-03 service runs as ubuntu user and group', () => {
  assert.match(serviceUnit, /^User=ubuntu$/m);
  assert.match(serviceUnit, /^Group=ubuntu$/m);
});

test('UNIT-04 service uses the instance-specific backend working directory', () => {
  assert.match(
    serviceUnit,
    /^WorkingDirectory=\/var\/www\/esadar-%i\/backend$/m,
  );
});

test('UNIT-05 service uses canonical Node and CLI absolute paths', () => {
  assert.match(
    serviceUnit,
    /^ExecStart=\/usr\/bin\/node \/var\/www\/esadar-%i\/backend\/scripts\/expire-reservations\.mjs$/m,
  );
});

test('UNIT-06 service does not use EnvironmentFile', () => {
  assert.doesNotMatch(serviceUnit, /^EnvironmentFile=/m);
});

test('UNIT-07 units do not embed environment credentials', () => {
  assert.doesNotMatch(
    allUnits,
    /^(?:Environment|EnvironmentFile)=|\b(?:DB_PASSWORD|JWT_SECRET|SMTP_PASS(?:WORD)?|MERCADO_PAGO_ACCESS_TOKEN)=/im,
  );
});

test('UNIT-08 service has no PM2 or nginx dependency', () => {
  assert.doesNotMatch(serviceUnit, /\b(?:pm2|nginx)\b/i);
});

test('UNIT-09 service has no restart loop', () => {
  assert.doesNotMatch(serviceUnit, /^Restart=(?:always|on-failure)$/mi);
});

test('UNIT-10 partial failure is not declared successful', () => {
  assert.doesNotMatch(serviceUnit, /^SuccessExitStatus=.*$/mi);
});

test('UNIT-11 service has the explicit fifteen-minute timeout', () => {
  assert.match(serviceUnit, /^TimeoutStartSec=15min$/m);
});

test('UNIT-12 service waits for network-online target', () => {
  assert.match(serviceUnit, /^Wants=network-online\.target$/m);
  assert.match(serviceUnit, /^After=network-online\.target$/m);
});

test('UNIT-13 timer uses the frozen hourly calendar', () => {
  assert.match(timerUnit, /^OnCalendar=hourly$/m);
});

test('UNIT-14 timer is persistent', () => {
  assert.match(timerUnit, /^Persistent=true$/m);
});

test('UNIT-15 timer targets the service from the same instance', () => {
  assert.match(
    timerUnit,
    /^Unit=esadar-expire-reservations@%i\.service$/m,
  );
});

test('UNIT-16 timer installs into timers.target', () => {
  assert.match(timerUnit, /^WantedBy=timers\.target$/m);
});

test('UNIT-17 timer has no randomized delay', () => {
  assert.doesNotMatch(timerUnit, /^RandomizedDelaySec=/m);
});

test('UNIT-18 timer defines no additional frequency', () => {
  assert.doesNotMatch(timerUnit, /^On(?:UnitActive|Boot)Sec=/m);
  assert.equal((timerUnit.match(/^OnCalendar=/gm) || []).length, 1);
});

test('UNIT-19 units contain no secret or credential markers', () => {
  assert.doesNotMatch(
    allUnits,
    /password|token|secret|MERCADO_PAGO|SMTP_PASS|JWT_SECRET|DB_PASSWORD/i,
  );
});
