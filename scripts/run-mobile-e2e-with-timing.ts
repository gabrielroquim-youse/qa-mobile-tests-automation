#!/usr/bin/env ts-node
/**
 * Executa E2E mobile no device conectado, captura log e gera dashboard.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectMobileDeviceInfo } from './lib/mobileDeviceInfo';
import { executionIdFromIso } from './lib/mobileTimingHistory';

const ROOT = join(__dirname, '..');
const REPORTS_DIR = join(ROOT, 'reports');

function main(): void {
  const startedAt = new Date();
  const executionId = executionIdFromIso(startedAt.toISOString());
  mkdirSync(REPORTS_DIR, { recursive: true });

  const deviceInfo = collectMobileDeviceInfo({
    udid: process.env.ANDROID_UDID,
    appPackage: process.env.ANDROID_APP_PACKAGE ?? 'br.com.youse.debug',
  });
  const deviceJsonPath = join(REPORTS_DIR, `device-info-${executionId}.json`);
  writeFileSync(deviceJsonPath, `${JSON.stringify(deviceInfo, null, 2)}\n`, 'utf8');

  const logPath = join(REPORTS_DIR, `mobile-run-${executionId}.log`);
  console.log(`Device: ${deviceInfo.manufacturer} ${deviceInfo.model} · Android ${deviceInfo.androidVersion}`);
  console.log(`Rede: ${deviceInfo.networkTransport} · ${deviceInfo.networkType}`);
  console.log(`Log: ${logPath}`);

  let exitCode = 0;
  let output = '';
  try {
    output = execSync('npm run test:e2e:android 2>&1', {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '0' },
      maxBuffer: 50 * 1024 * 1024,
    });
    process.stdout.write(output);
  } catch (error) {
    exitCode = (error as { status?: number }).status ?? 1;
    output = `${(error as { stdout?: string }).stdout ?? ''}${(error as { stderr?: string }).stderr ?? ''}`;
    process.stdout.write(output);
  }

  writeFileSync(logPath, output, 'utf8');

  execSync(
    `npx ts-node scripts/generate-mobile-e2e-report.ts --log "${logPath.replace(/\\/g, '/')}" --device "${deviceJsonPath.replace(/\\/g, '/')}" --exit-code ${exitCode}`,
    { cwd: ROOT, stdio: 'inherit' },
  );

  if (exitCode !== 0) process.exit(exitCode);
}

main();
