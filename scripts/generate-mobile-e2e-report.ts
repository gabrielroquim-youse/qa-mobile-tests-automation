#!/usr/bin/env ts-node
/**
 * Gera dashboard de execução mobile E2E (padrão qa-e2e-tests-automation).
 *
 * Saídas:
 *   docs/reports/mobile-e2e-dashboard.md  — log acumulado (dashboard)
 *   docs/reports/mobile-e2e-latest.json   — última run
 *   docs/reports/mobile-e2e-log.json      — histórico (até 100)
 *   docs/reports/history/{id}/            — snapshot da execução
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectMobileDeviceInfo, formatDeviceLabel } from './lib/mobileDeviceInfo';
import {
  appendMobileTimingLog,
  buildEntryFromDevice,
  executionIdFromIso,
  formatDuration,
  formatUtc,
  loadMobileTimingLog,
  renderMobileDashboardMarkdown,
  saveExecutionHistory,
  type MobileTimingLogEntry,
} from './lib/mobileTimingHistory';

const ROOT = join(__dirname, '..');
const DOCS_REPORTS = join(ROOT, 'docs', 'reports');
const HISTORY_DIR = join(DOCS_REPORTS, 'history');
const LOG_JSON = join(DOCS_REPORTS, 'mobile-e2e-log.json');
const LATEST_JSON = join(DOCS_REPORTS, 'mobile-e2e-latest.json');
const DASHBOARD_MD = join(DOCS_REPORTS, 'mobile-e2e-dashboard.md');
const REPORT_MD = join(DOCS_REPORTS, 'mobile-e2e-report.md');

interface ParsedRun {
  spec: string;
  tests: { title: string; status: 'passed' | 'failed' | 'skipped'; durationMs: number | null }[];
  passed: number;
  failed: number;
  skipped: number;
  wallClockMs: number | null;
}

function parseArgs(argv: string[]): { logPath?: string; deviceJson?: string; exitCode: number } {
  let logPath: string | undefined;
  let deviceJson: string | undefined;
  let exitCode = 0;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--log' && argv[i + 1]) logPath = argv[++i];
    else if (argv[i] === '--device' && argv[i + 1]) deviceJson = argv[++i];
    else if (argv[i] === '--exit-code' && argv[i + 1]) exitCode = parseInt(argv[++i], 10) || 0;
  }

  return { logPath, deviceJson, exitCode };
}

function parseWdioLog(content: string): ParsedRun {
  const tests: ParsedRun['tests'] = [];
  let wallClockMs: number | null = null;
  let spec = 'cotacaoAuto.spec.ts';

  for (const line of content.split(/\r?\n/)) {
    const specMatch = line.match(/file:\/\/\/.*[\\/]([^\\/]+\.spec\.ts)/i);
    if (specMatch) spec = specMatch[1];

    const passMatch = line.match(/[✓✔]\s+(.+?)(?:\s+\(([\d.]+)\s*(ms|s|m|min)\))?$/i);
    const failMatch = line.match(/[✗×✖]\s+(.+?)(?:\s+\(([\d.]+)\s*(ms|s|m|min)\))?$/i);

    const parseDur = (value?: string, unit?: string): number | null => {
      if (!value) return null;
      const n = parseFloat(value);
      const u = (unit ?? 'ms').toLowerCase();
      if (u === 'ms') return n;
      if (u === 's') return n * 1000;
      return n * 60_000;
    };

    if (passMatch) {
      tests.push({ title: passMatch[1].trim(), status: 'passed', durationMs: parseDur(passMatch[2], passMatch[3]) });
    } else if (failMatch) {
      tests.push({ title: failMatch[1].trim(), status: 'failed', durationMs: parseDur(failMatch[2], failMatch[3]) });
    }

    const wallMatch =
      line.match(/(\d+)\s+failing\s+\(([\d.]+)\s*(ms|s|m|min)\)/i) ??
      line.match(/(\d+)\s+passing\s+\(([\d.]+)\s*(ms|s|m|min)\)/i) ??
      line.match(/in\s+(\d{2}):(\d{2}):(\d{2})/) ??
      line.match(/in\s+(\d{2}):(\d{2})/);

    if (wallMatch) {
      if (wallMatch[2] !== undefined && wallMatch[3] === undefined && wallMatch[1].includes(':')) {
        const parts = wallMatch[0].match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
        if (parts) {
          const h = parseInt(parts[1], 10);
          const m = parseInt(parts[2], 10);
          const s = parseInt(parts[3] ?? '0', 10);
          wallClockMs = ((h * 60 + m) * 60 + s) * 1000;
        }
      } else if (wallMatch[2] && wallMatch[3]) {
        const n = parseFloat(wallMatch[2]);
        const u = wallMatch[3].toLowerCase();
        wallClockMs = u === 'ms' ? n : u === 's' ? n * 1000 : n * 60_000;
      }
    }
  }

  const passed = tests.filter((t) => t.status === 'passed').length;
  const failed = tests.filter((t) => t.status === 'failed').length;
  const skipped = tests.filter((t) => t.status === 'skipped').length;

  if (wallClockMs === null && content.includes('Spec Files:')) {
    const totalMatch = content.match(/in\s+(\d{2}):(\d{2}):(\d{2})/);
    if (totalMatch) {
      wallClockMs =
        (parseInt(totalMatch[1], 10) * 3600 + parseInt(totalMatch[2], 10) * 60 + parseInt(totalMatch[3], 10)) * 1000;
    } else {
      const shortMatch = content.match(/in\s+(\d{2}):(\d{2})/);
      if (shortMatch) wallClockMs = (parseInt(shortMatch[1], 10) * 60 + parseInt(shortMatch[2], 10)) * 1000;
    }
  }

  return { spec, tests, passed, failed, skipped, wallClockMs };
}

function renderLatestReport(entry: MobileTimingLogEntry, parsed: ParsedRun, logContent: string): string {
  const lines = [
    '# Relatório — Mobile E2E (última execução)',
    '',
    `> Gerado em **${formatUtc(entry.generatedAt)}** · execução \`${entry.executionId}\``,
    '',
    '## Ambiente',
    '',
    '| Campo | Valor |',
    '| ----- | ----- |',
    `| Device | ${entry.device.label} |`,
    `| UDID | \`${entry.device.udid ?? '—'}\` |`,
    `| Android | ${entry.device.androidVersion ?? '—'} |`,
    `| Rede (transporte) | ${entry.network.transport} |`,
    `| Rede (tipo) | ${entry.network.type} |`,
    `| Wi-Fi SSID | ${entry.network.wifiSsid ?? '—'} |`,
    `| Operadora | ${entry.network.carrier ?? '—'} |`,
    `| App | \`${entry.app.package ?? '—'}\` |`,
    `| App instalado | ${entry.app.installed ? 'Sim' : 'Não'} |`,
    '',
    '## Resultado',
    '',
    '| Métrica | Valor |',
    '| ------- | ----- |',
    `| Spec | \`${parsed.spec}\` |`,
    `| Status | **${entry.status}** |`,
    `| Testes | ${entry.tests} |`,
    `| Passou | ${entry.passed} |`,
    `| Falhou | ${entry.failed} |`,
    `| Wall-clock | ${formatDuration(entry.wallClockMs)} |`,
    '',
    '## Testes',
    '',
    '| Status | Teste | Duração |',
    '| ------ | ----- | -------: |',
  ];

  for (const test of parsed.tests) {
    lines.push(`| ${test.status === 'passed' ? '✓' : '✗'} | ${test.title} | ${formatDuration(test.durationMs)} |`);
  }

  if (parsed.tests.length === 0) {
    lines.push('| — | _(nenhum teste parseado do log — ver log bruto)_ | — |');
  }

  lines.push(
    '',
    '## Log bruto',
    '',
    '<details>',
    '<summary>stdout WDIO</summary>',
    '',
    '```',
    logContent.slice(-12000),
    '```',
    '',
    '</details>',
    '',
    '---',
    '',
    '_Gerado por `npm run mobile:e2e:report`._',
    '',
  );

  return lines.join('\n');
}

function main(): void {
  const { logPath, deviceJson, exitCode } = parseArgs(process.argv.slice(2));
  if (!logPath || !existsSync(logPath)) {
    console.error(
      'Uso: npx ts-node scripts/generate-mobile-e2e-report.ts --log reports/mobile-run-....log [--device reports/device-info.json] [--exit-code 0]',
    );
    process.exit(1);
  }

  const logContent = readFileSync(logPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = parseWdioLog(logContent);
  const generatedAt = new Date().toISOString();
  const executionId = executionIdFromIso(generatedAt);

  let deviceInfo = collectMobileDeviceInfo({
    udid: process.env.ANDROID_UDID,
    appPackage: process.env.ANDROID_APP_PACKAGE ?? 'br.com.youse.debug',
  });

  if (deviceJson && existsSync(deviceJson)) {
    try {
      deviceInfo = { ...deviceInfo, ...JSON.parse(readFileSync(deviceJson, 'utf8')) };
    } catch {
      // mantém coleta adb
    }
  }

  const deviceLabel = formatDeviceLabel(deviceInfo);
  const tests = parsed.tests.length || parsed.passed + parsed.failed + parsed.skipped || 1;
  const passed = parsed.passed;
  const failed = parsed.failed || (exitCode !== 0 && parsed.passed === 0 ? 1 : 0);
  const status: MobileTimingLogEntry['status'] = failed > 0 ? (passed > 0 ? 'partial' : 'failed') : 'passed';

  const entry: MobileTimingLogEntry = {
    executionId,
    generatedAt,
    spec: parsed.spec,
    ...buildEntryFromDevice(deviceInfo, deviceLabel),
    tests,
    passed,
    failed,
    skipped: parsed.skipped,
    wallClockMs: parsed.wallClockMs,
    status,
    logFile: logPath.replace(/\\/g, '/').split('/').pop() ?? null,
    historyPath: `history/${executionId}`,
  };

  mkdirSync(DOCS_REPORTS, { recursive: true });
  mkdirSync(HISTORY_DIR, { recursive: true });

  const reportMd = renderLatestReport(entry, parsed, logContent);
  const executionJson = JSON.stringify({ ...entry, deviceInfo, parsed }, null, 2);

  saveExecutionHistory(HISTORY_DIR, executionId, [
    { name: 'execution.json', content: `${executionJson}\n` },
    { name: 'report.md', content: reportMd },
    { name: 'run.log', content: logContent },
  ]);

  writeFileSync(LATEST_JSON, `${JSON.stringify({ ...entry, deviceInfo, parsed }, null, 2)}\n`, 'utf8');
  writeFileSync(REPORT_MD, reportMd, 'utf8');
  appendMobileTimingLog(LOG_JSON, entry);
  writeFileSync(DASHBOARD_MD, renderMobileDashboardMarkdown(loadMobileTimingLog(LOG_JSON)), 'utf8');

  console.log(`Dashboard: ${DASHBOARD_MD}`);
  console.log(`Relatório: ${REPORT_MD}`);
  console.log(`Histórico: ${join(HISTORY_DIR, executionId)}`);
}

main();
