import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MobileDeviceInfo } from './mobileDeviceInfo';

export function formatDuration(ms: number | null): string {
  if (ms === null || ms <= 0) return '—';
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)} min`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatUtc(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function executionIdFromIso(iso: string): string {
  return iso.slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

export interface MobileTimingLogEntry {
  executionId: string;
  generatedAt: string;
  spec: string;
  device: {
    label: string;
    udid: string | null;
    model: string | null;
    androidVersion: string | null;
  };
  network: {
    transport: string;
    type: string;
    wifiSsid: string | null;
    carrier: string | null;
  };
  app: {
    package: string | null;
    installed: boolean;
  };
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  wallClockMs: number | null;
  status: 'passed' | 'failed' | 'partial';
  logFile: string | null;
  historyPath: string;
}

export function loadMobileTimingLog(logJsonPath: string): MobileTimingLogEntry[] {
  if (!existsSync(logJsonPath)) return [];
  try {
    return JSON.parse(readFileSync(logJsonPath, 'utf8')) as MobileTimingLogEntry[];
  } catch {
    return [];
  }
}

export function appendMobileTimingLog(logJsonPath: string, entry: MobileTimingLogEntry, max = 100): void {
  const entries = loadMobileTimingLog(logJsonPath).filter((e) => e.executionId !== entry.executionId);
  entries.unshift(entry);
  mkdirSync(join(logJsonPath, '..'), { recursive: true });
  writeFileSync(logJsonPath, `${JSON.stringify(entries.slice(0, max), null, 2)}\n`, 'utf8');
}

export function renderMobileDashboardMarkdown(entries: MobileTimingLogEntry[]): string {
  const lines: string[] = [
    '# Dashboard — Mobile E2E (Appium / WebdriverIO)',
    '',
    `> ${entries.length} execução(ões) · mais recente primeiro · detalhes em [\`history/\`](history/)`,
    '',
    '| # | Execução | Device | Android | Rede | Transporte | App | Testes | ✓ | ✗ | Wall-clock | Status | Histórico |',
    '| -: | -------- | ------ | -------: | ---- | ---------- | --- | -----: | -: | -: | ---------: | ------ | --------- |',
  ];

  entries.forEach((entry, index) => {
    const network = entry.network.wifiSsid ? `${entry.network.type} (${entry.network.wifiSsid})` : entry.network.type;
    lines.push(
      `| ${entries.length - index} | ${formatUtc(entry.generatedAt)} | ${entry.device.label} | ${entry.device.androidVersion ?? '—'} | ${network} | ${entry.network.transport} | \`${entry.app.package ?? '—'}\` | ${entry.tests} | ${entry.passed} | ${entry.failed} | ${formatDuration(entry.wallClockMs)} | ${entry.status} | [\`${entry.executionId}\`](history/${entry.executionId}/) |`,
    );
  });

  lines.push(
    '',
    '---',
    '',
    '_Atualizado por `npm run mobile:e2e:report` — espelha o padrão `qa-e2e-tests-automation/docs/reports/`._',
    '',
  );
  return lines.join('\n');
}

export function saveExecutionHistory(
  historyRoot: string,
  executionId: string,
  files: { name: string; content: string }[],
): string {
  const dir = join(historyRoot, executionId);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(dir, file.name), file.content, 'utf8');
  }
  return `history/${executionId}`;
}

export function buildEntryFromDevice(
  info: MobileDeviceInfo,
  deviceLabel: string,
): Pick<MobileTimingLogEntry, 'device' | 'network' | 'app'> {
  return {
    device: {
      label: deviceLabel,
      udid: info.udid,
      model: info.model,
      androidVersion: info.androidVersion,
    },
    network: {
      transport: info.networkTransport,
      type: info.networkType,
      wifiSsid: info.wifiSsid,
      carrier: info.carrier,
    },
    app: {
      package: info.appPackage,
      installed: info.appInstalled,
    },
  };
}
