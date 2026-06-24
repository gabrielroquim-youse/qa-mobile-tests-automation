#!/usr/bin/env ts-node
/**
 * Gera dashboard de A11y mobile a partir dos JSONs persistidos pelo runner
 * (`tests/helpers/a11y/runner.ts` → `reports/a11y/{executionId}/*.json`).
 *
 * Saídas (espelham `qa-e2e-tests-automation/docs/reports/`):
 *   docs/reports/mobile-a11y-dashboard.md   — dashboard markdown (histórico)
 *   docs/reports/mobile-a11y-latest.md      — detalhe da última execução
 *   docs/reports/mobile-a11y-latest.html    — versão web standalone
 *   docs/reports/mobile-a11y-latest.json    — última run machine-readable
 *   docs/reports/mobile-a11y-log.json       — índice acumulado (até 100)
 *   docs/reports/history/a11y-{id}/         — snapshot por execução
 *
 * Uso:
 *   npm run mobile:a11y:report                       # último run em reports/a11y/
 *   npm run mobile:a11y:report -- --execution-id ID  # run específico
 *   npm run mobile:a11y:report -- --device "Pixel 7" --android 14
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { A11yReport } from '../tests/helpers/a11y/types';
import {
  aggregateEntry,
  appendA11yLog,
  formatUtc,
  loadA11yLog,
  renderA11yDashboardMarkdown,
  renderA11yLatestReport,
  saveExecutionHistory,
} from './lib/a11yHistory';
import { renderA11yDashboardHtml } from './lib/a11yDashboardHtml';

const ROOT = join(__dirname, '..');
const REPORTS_INPUT = join(ROOT, 'reports', 'a11y');
const DOCS_REPORTS = join(ROOT, 'docs', 'reports');
const HISTORY_DIR = join(DOCS_REPORTS, 'history');
const LOG_JSON = join(DOCS_REPORTS, 'mobile-a11y-log.json');
const LATEST_JSON = join(DOCS_REPORTS, 'mobile-a11y-latest.json');
const LATEST_MD = join(DOCS_REPORTS, 'mobile-a11y-latest.md');
const LATEST_HTML = join(DOCS_REPORTS, 'mobile-a11y-latest.html');
const DASHBOARD_MD = join(DOCS_REPORTS, 'mobile-a11y-dashboard.md');

interface Args {
  executionId?: string;
  device?: string;
  android?: string;
  ios?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const next = argv[i + 1];
    if (argv[i] === '--execution-id' && next) args.executionId = argv[++i];
    else if (argv[i] === '--device' && next) args.device = argv[++i];
    else if (argv[i] === '--android' && next) args.android = argv[++i];
    else if (argv[i] === '--ios' && next) args.ios = argv[++i];
  }
  return args;
}

function pickLatestExecution(): string | null {
  if (!existsSync(REPORTS_INPUT)) return null;
  const dirs = readdirSync(REPORTS_INPUT)
    .map((name) => ({ name, path: join(REPORTS_INPUT, name) }))
    .filter((e) => {
      try {
        return statSync(e.path).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => statSync(b.path).mtimeMs - statSync(a.path).mtimeMs);
  return dirs[0]?.name ?? null;
}

function loadReports(executionId: string): A11yReport[] {
  const dir = join(REPORTS_INPUT, executionId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as A11yReport)
    .filter((r) => Array.isArray(r.findings));
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const executionId = args.executionId ?? pickLatestExecution();

  if (!existsSync(DOCS_REPORTS)) mkdirSync(DOCS_REPORTS, { recursive: true });
  if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });

  if (!executionId) {
    console.warn('[a11y-report] Nenhum run encontrado em reports/a11y/ — gerando dashboard vazio.');
    writeFileSync(DASHBOARD_MD, renderA11yDashboardMarkdown([]), 'utf8');
    writeFileSync(LATEST_HTML, renderA11yDashboardHtml([]), 'utf8');
    writeFileSync(LATEST_JSON, '{}\n', 'utf8');
    return;
  }

  const reports = loadReports(executionId);
  if (reports.length === 0) {
    console.warn(`[a11y-report] Execução "${executionId}" sem reports válidos.`);
    return;
  }

  const generatedAt = new Date().toISOString();
  const historyId = `a11y-${executionId}`;

  const entry = aggregateEntry({
    executionId,
    generatedAt,
    reports,
    deviceLabel: args.device ?? process.env.A11Y_DEVICE_LABEL ?? 'Mobile (local)',
    androidVersion: args.android ?? process.env.A11Y_ANDROID_VERSION ?? null,
    iosVersion: args.ios ?? process.env.A11Y_IOS_VERSION ?? null,
    historyPath: `history/${historyId}`,
  });

  // Snapshot por execução
  saveExecutionHistory(HISTORY_DIR, historyId, [
    { name: 'execution.json', content: JSON.stringify(entry, null, 2) },
    { name: 'report.md', content: renderA11yLatestReport(entry, reports) },
    ...reports.map((r) => ({
      name: `${slug(r.screen)}-${r.platform}.json`,
      content: JSON.stringify(r, null, 2),
    })),
  ]);

  // Índice + last
  appendA11yLog(LOG_JSON, entry);
  writeFileSync(LATEST_JSON, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
  writeFileSync(LATEST_MD, renderA11yLatestReport(entry, reports), 'utf8');

  const allEntries = loadA11yLog(LOG_JSON);
  writeFileSync(DASHBOARD_MD, renderA11yDashboardMarkdown(allEntries), 'utf8');
  writeFileSync(LATEST_HTML, renderA11yDashboardHtml(allEntries), 'utf8');

  console.log(
    `[a11y-report] ✓ ${entry.totals.screens} tela(s) · ❌${entry.totals.errors} ⚠️${entry.totals.warnings} ℹ️${entry.totals.infos} → ${formatUtc(generatedAt)}`,
  );
  console.log(`[a11y-report] Dashboard: ${DASHBOARD_MD}`);
  console.log(`[a11y-report] HTML:      ${LATEST_HTML}`);
  console.log(`[a11y-report] Snapshot:  history/${historyId}/`);
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

main();
