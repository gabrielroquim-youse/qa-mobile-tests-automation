/**
 * Helpers de histórico para o dashboard de A11y.
 * Espelha o padrão de `mobileTimingHistory.ts` (E2E) — JSON acumulado,
 * markdown tabular e snapshot por execução.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { A11yFinding, A11yReport, A11yRuleId } from '../../tests/helpers/a11y/types';

export interface A11yScreenSummary {
  screen: string;
  platform: 'android' | 'ios';
  totalFindings: number;
  errors: number;
  warnings: number;
  infos: number;
  passed: boolean;
  byRule: Record<string, number>;
}

export interface A11yLogEntry {
  executionId: string;
  generatedAt: string;
  platform: 'android' | 'ios' | 'mixed';
  device: {
    label: string;
    androidVersion: string | null;
    iosVersion: string | null;
  };
  totals: {
    screens: number;
    findings: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  byRule: Record<string, { errors: number; warnings: number; infos: number }>;
  screens: A11yScreenSummary[];
  status: 'passed' | 'failed' | 'warning';
  historyPath: string;
}

export function formatUtc(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function executionIdFromIso(iso: string): string {
  return iso.slice(0, 19).replace('T', '_').replace(/:/g, '-');
}

export function summarizeReport(report: A11yReport): A11yScreenSummary {
  const byRule: Record<string, number> = {};
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const f of report.findings as A11yFinding[]) {
    byRule[f.rule] = (byRule[f.rule] ?? 0) + 1;
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warning') warnings++;
    else infos++;
  }

  return {
    screen: report.screen,
    platform: report.platform,
    totalFindings: report.findings.length,
    errors,
    warnings,
    infos,
    passed: report.passed,
    byRule,
  };
}

export function aggregateEntry(params: {
  executionId: string;
  generatedAt: string;
  reports: A11yReport[];
  deviceLabel: string;
  androidVersion?: string | null;
  iosVersion?: string | null;
  historyPath: string;
}): A11yLogEntry {
  const summaries = params.reports.map(summarizeReport);
  const platforms = new Set(summaries.map((s) => s.platform));
  const platform = platforms.size > 1 ? 'mixed' : (Array.from(platforms)[0] ?? 'android');

  const byRule: A11yLogEntry['byRule'] = {};
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const summary of summaries) {
    errors += summary.errors;
    warnings += summary.warnings;
    infos += summary.infos;
    for (const rule of Object.keys(summary.byRule)) {
      byRule[rule] ??= { errors: 0, warnings: 0, infos: 0 };
    }
  }

  for (const report of params.reports) {
    for (const f of report.findings) {
      byRule[f.rule] ??= { errors: 0, warnings: 0, infos: 0 };
      if (f.severity === 'error') byRule[f.rule].errors++;
      else if (f.severity === 'warning') byRule[f.rule].warnings++;
      else byRule[f.rule].infos++;
    }
  }

  const status: A11yLogEntry['status'] = errors > 0 ? 'failed' : warnings > 0 ? 'warning' : 'passed';

  return {
    executionId: params.executionId,
    generatedAt: params.generatedAt,
    platform,
    device: {
      label: params.deviceLabel,
      androidVersion: params.androidVersion ?? null,
      iosVersion: params.iosVersion ?? null,
    },
    totals: {
      screens: summaries.length,
      findings: summaries.reduce((acc, s) => acc + s.totalFindings, 0),
      errors,
      warnings,
      infos,
    },
    byRule,
    screens: summaries,
    status,
    historyPath: params.historyPath,
  };
}

export function loadA11yLog(logJsonPath: string): A11yLogEntry[] {
  if (!existsSync(logJsonPath)) return [];
  try {
    return JSON.parse(readFileSync(logJsonPath, 'utf8')) as A11yLogEntry[];
  } catch {
    return [];
  }
}

export function appendA11yLog(logJsonPath: string, entry: A11yLogEntry, max = 100): void {
  const entries = loadA11yLog(logJsonPath).filter((e) => e.executionId !== entry.executionId);
  entries.unshift(entry);
  mkdirSync(join(logJsonPath, '..'), { recursive: true });
  writeFileSync(logJsonPath, `${JSON.stringify(entries.slice(0, max), null, 2)}\n`, 'utf8');
}

function statusIcon(status: A11yLogEntry['status']): string {
  return status === 'passed' ? '✅' : status === 'warning' ? '⚠️' : '❌';
}

export function renderA11yDashboardMarkdown(entries: A11yLogEntry[]): string {
  const lines: string[] = [
    '# Dashboard — Mobile A11y (WCAG 2.2 AA · Appium)',
    '',
    `> ${entries.length} execução(ões) · mais recente primeiro · detalhes em [\`history/\`](history/) · versão web em [\`mobile-a11y-latest.html\`](mobile-a11y-latest.html)`,
    '',
    '| # | Execução | Plataforma | Device | Telas | ❌ Erros | ⚠️ Warnings | ℹ️ Infos | Status | Histórico |',
    '| -: | -------- | ---------- | ------ | ----: | -------: | ----------: | -------: | :----: | --------- |',
  ];

  entries.forEach((entry, index) => {
    const versao =
      entry.platform === 'android'
        ? `Android ${entry.device.androidVersion ?? '—'}`
        : entry.platform === 'ios'
          ? `iOS ${entry.device.iosVersion ?? '—'}`
          : 'mixed';
    lines.push(
      `| ${entries.length - index} | ${formatUtc(entry.generatedAt)} | ${versao} | ${entry.device.label} | ${entry.totals.screens} | ${entry.totals.errors} | ${entry.totals.warnings} | ${entry.totals.infos} | ${statusIcon(entry.status)} | [\`${entry.executionId}\`](history/${entry.executionId}/) |`,
    );
  });

  lines.push(
    '',
    '## Distribuição da última execução',
    '',
    entries[0] ? renderRuleBreakdown(entries[0]) : '_(sem execução registrada)_',
    '',
    '---',
    '',
    '_Atualizado por `npm run mobile:a11y:report` — espelha o padrão `qa-e2e-tests-automation/docs/reports/`._',
    '',
  );
  return lines.join('\n');
}

function renderRuleBreakdown(entry: A11yLogEntry): string {
  const rules = Object.keys(entry.byRule).sort();
  if (rules.length === 0) return '✅ Nenhum finding na última execução — excelente!';
  const lines = ['| Regra | ❌ | ⚠️ | ℹ️ |', '| ----- | -: | -: | -: |'];
  for (const rule of rules) {
    const counts = entry.byRule[rule];
    lines.push(`| \`${rule}\` | ${counts.errors} | ${counts.warnings} | ${counts.infos} |`);
  }
  return lines.join('\n');
}

export function renderA11yLatestReport(entry: A11yLogEntry, reports: A11yReport[]): string {
  const lines: string[] = [
    '# Relatório — Mobile A11y (última execução)',
    '',
    `> Gerado em **${formatUtc(entry.generatedAt)}** · execução \`${entry.executionId}\``,
    '',
    '## Ambiente',
    '',
    '| Campo | Valor |',
    '| ----- | ----- |',
    `| Device | ${entry.device.label} |`,
    `| Plataforma | ${entry.platform} |`,
    `| Android | ${entry.device.androidVersion ?? '—'} |`,
    `| iOS | ${entry.device.iosVersion ?? '—'} |`,
    '',
    '## Resumo',
    '',
    '| Métrica | Valor |',
    '| ------- | ----: |',
    `| Telas auditadas | ${entry.totals.screens} |`,
    `| Findings totais | ${entry.totals.findings} |`,
    `| ❌ Erros | ${entry.totals.errors} |`,
    `| ⚠️ Warnings | ${entry.totals.warnings} |`,
    `| ℹ️ Infos | ${entry.totals.infos} |`,
    `| Status | ${statusIcon(entry.status)} **${entry.status}** |`,
    '',
    '## Resultado por tela',
    '',
    '| Tela | Plataforma | ❌ | ⚠️ | ℹ️ | Status |',
    '| ---- | ---------- | -: | -: | -: | :----: |',
  ];
  for (const screen of entry.screens) {
    lines.push(
      `| ${screen.screen} | ${screen.platform} | ${screen.errors} | ${screen.warnings} | ${screen.infos} | ${screen.passed ? '✅' : '❌'} |`,
    );
  }

  lines.push('', '## Findings detalhados', '');
  for (const report of reports) {
    lines.push(`### ${report.screen} (${report.platform})`, '');
    if (report.findings.length === 0) {
      lines.push('_Sem findings._', '');
      continue;
    }
    lines.push('| Severidade | Regra | Elemento | Mensagem |', '| ---------- | ----- | -------- | -------- |');
    for (const f of report.findings) {
      const icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`| ${icon} ${f.severity} | \`${f.rule}\` | ${escapeMd(f.element ?? '—')} | ${escapeMd(f.message)} |`);
    }
    lines.push('');
  }

  lines.push('---', '', '_Gerado por `npm run mobile:a11y:report`._', '');
  return lines.join('\n');
}

function escapeMd(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
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

export type { A11yRuleId };
