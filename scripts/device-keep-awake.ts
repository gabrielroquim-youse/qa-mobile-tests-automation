#!/usr/bin/env ts-node
/**
 * Liga/desliga keep-awake manualmente (útil antes de debugar no device).
 *
 * Uso:
 *   npm run device:keep-awake          # liga
 *   npm run device:keep-awake -- off     # restaura padrão
 */
import 'dotenv/config';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { enableKeepAwake, restoreKeepAwake, type KeepAwakeSnapshot } from './lib/androidKeepAwake';

const ROOT = join(__dirname, '..');
const SNAPSHOT_FILE = join(ROOT, '.device-keep-awake.json');
const serial = process.env.ANDROID_UDID || undefined;
const mode = process.argv[2]?.toLowerCase();

if (mode === 'off') {
  if (!existsSync(SNAPSHOT_FILE)) {
    console.log('Nenhum snapshot — nada a restaurar.');
    process.exit(0);
  }
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_FILE, 'utf8')) as KeepAwakeSnapshot;
  restoreKeepAwake(serial, snapshot);
  console.log('Keep-awake desligado. Timeout de tela restaurado.');
  process.exit(0);
}

const snapshot = enableKeepAwake(serial);
writeFileSync(SNAPSHOT_FILE, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(
  `Keep-awake ligado${serial ? ` (${serial})` : ''}. Rode "npm run device:keep-awake -- off" para restaurar.`,
);
