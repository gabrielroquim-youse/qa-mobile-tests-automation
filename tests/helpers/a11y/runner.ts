/**
 * Runner único de auditoria de acessibilidade mobile.
 *
 * Centraliza:
 * - execução do audit nativo (Google ATF via UiAutomator2)
 * - checks manuais (labels, touch target, foco, dynamic type, etc.)
 * - agregação em A11yReport
 * - anexo do report no Allure
 * - persistência em `reports/a11y/{executionId}/{screen}-{platform}.json`
 *   para alimentar o gerador de dashboard (scripts/generate-a11y-report.ts)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import allure from '@wdio/allure-reporter';
import { performNativeAccessibilityAudit } from './androidAudit';
import {
  checkDarkMode,
  checkDynamicType,
  checkFocusOrder,
  checkGestureAlternatives,
  checkKeyboardNav,
  checkLabels,
  checkOrientation,
  checkTouchTargets,
  noteContrastCoverage,
  withShortImplicitWait,
} from './checks';
import { checkContrastPixelPerfect } from './contrast';
import type { A11yFinding, A11yReport, A11yRuleId, A11yScreenMatrix } from './types';

const ALL_RULES: A11yRuleId[] = [
  'labels',
  'touch-target',
  'focus-order',
  'contrast',
  'dynamic-type',
  'orientation',
  'keyboard',
  'gesture-alternatives',
  'dark-mode',
];

function shouldRun(rule: A11yRuleId, matrix: A11yScreenMatrix): boolean {
  return (matrix.rules ?? ALL_RULES).includes(rule);
}

/**
 * ID de execução único por sessão WDIO (mesmo entre múltiplos audits no mesmo run).
 * Pode ser sobrescrito via env `A11Y_EXECUTION_ID` (usado pelo CI/script).
 */
let cachedExecutionId: string | null = null;
function executionId(): string {
  if (cachedExecutionId) return cachedExecutionId;
  cachedExecutionId =
    process.env.A11Y_EXECUTION_ID || new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
  return cachedExecutionId;
}

const REPORTS_ROOT = process.env.A11Y_REPORTS_DIR || join(process.cwd(), 'reports', 'a11y');

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function persistToDisk(report: A11yReport): string | null {
  try {
    const dir = join(REPORTS_ROOT, executionId());
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const fileName = `${slug(report.screen)}-${report.platform}.json`;
    const path = join(dir, fileName);
    writeFileSync(path, JSON.stringify({ ...report, generatedAt: new Date().toISOString() }, null, 2), 'utf8');
    return path;
  } catch {
    return null;
  }
}

/**
 * Executa auditoria conforme matriz da tela. Não lança — retorna o
 * report e cabe ao spec asserir `report.passed`.
 */
export async function runA11yAudit(matrix: A11yScreenMatrix): Promise<A11yReport> {
  const platform: 'android' | 'ios' = driver.isAndroid ? 'android' : 'ios';
  const findings: A11yFinding[] = [];

  await withShortImplicitWait(async () => {
    const native = await performNativeAccessibilityAudit();
    findings.push(...native);

    if (shouldRun('labels', matrix)) {
      findings.push(...(await checkLabels(matrix.expectedLabels)));
    }
    if (shouldRun('touch-target', matrix)) {
      findings.push(...(await checkTouchTargets(matrix.expectedLabels)));
    }
    if (shouldRun('focus-order', matrix)) {
      findings.push(...(await checkFocusOrder(matrix.expectedLabels)));
    }
    if (shouldRun('contrast', matrix)) {
      findings.push(...(await noteContrastCoverage(native)));
      findings.push(
        ...(await checkContrastPixelPerfect(matrix.expectedLabels, {
          targets: matrix.contrastTargets,
          threshold: matrix.contrastThreshold,
        })),
      );
    }
    if (shouldRun('keyboard', matrix) && matrix.inputs?.length) {
      findings.push(...(await checkKeyboardNav(matrix.inputs)));
    }
    if (shouldRun('gesture-alternatives', matrix) && matrix.gestureAlternatives?.length) {
      findings.push(...(await checkGestureAlternatives(matrix.gestureAlternatives)));
    }
    if (shouldRun('dynamic-type', matrix)) {
      findings.push(...(await checkDynamicType(matrix.expectedLabels)));
    }
    if (shouldRun('orientation', matrix)) {
      findings.push(...(await checkOrientation(matrix.expectedLabels)));
    }
    if (shouldRun('dark-mode', matrix)) {
      findings.push(...(await checkDarkMode(matrix.expectedLabels)));
    }
  });

  const report: A11yReport = {
    screen: matrix.name,
    platform,
    findings,
    passed: !findings.some((f) => f.severity === 'error'),
  };

  attachReport(report);
  persistToDisk(report);
  return report;
}

/**
 * Açúcar sintático para usar DENTRO de specs E2E quando você quer auditar a tela
 * já carregada sem importar a matriz separadamente.
 *
 * Diferente de `runA11yAudit`, ele apenas registra warning em caso de falha
 * para não mascarar regressões funcionais do happy-path.
 */
export async function auditCurrentScreen(matrix: A11yScreenMatrix): Promise<A11yReport> {
  const report = await runA11yAudit(matrix);
  if (!report.passed) {
    const errors = report.findings.filter((f) => f.severity === 'error').length;
    console.warn(`[a11y] ${report.screen}: ${errors} erro(s) — ver report no Allure.`);
  }
  return report;
}

function attachReport(report: A11yReport): void {
  try {
    allure.addAttachment(`A11y — ${report.screen}`, JSON.stringify(report, null, 2), 'application/json');
    allure.addDescription(summarize(report), 'markdown');
  } catch {
    // Allure pode não estar disponível fora do runner WDIO
  }
}

export function summarize(report: A11yReport): string {
  if (report.findings.length === 0) {
    return `✅ **A11y — ${report.screen}** (${report.platform}): sem findings`;
  }
  const grouped: Record<A11yRuleId, A11yFinding[]> = {
    labels: [],
    'touch-target': [],
    'focus-order': [],
    contrast: [],
    'dynamic-type': [],
    orientation: [],
    keyboard: [],
    'gesture-alternatives': [],
    'dark-mode': [],
  };
  for (const f of report.findings) grouped[f.rule].push(f);

  const lines = [`### A11y — ${report.screen} (${report.platform})`, ''];
  for (const rule of Object.keys(grouped) as A11yRuleId[]) {
    const list = grouped[rule];
    if (list.length === 0) continue;
    lines.push(`**${rule}** (${list.length}):`);
    for (const f of list) {
      const icon = f.severity === 'error' ? '❌' : f.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`- ${icon} ${f.message}${f.element ? ` _(elemento: ${f.element})_` : ''}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/** Asserção conveniente para usar no `it(...)` */
export function expectA11yPassed(report: A11yReport): void {
  if (report.passed) return;
  const errors = report.findings.filter((f) => f.severity === 'error');
  throw new Error(
    `Audit de acessibilidade falhou em "${report.screen}" (${errors.length} erros):\n` +
      errors.map((f) => `  - [${f.rule}] ${f.message}`).join('\n') +
      '\n\nReport completo:\n' +
      summarize(report),
  );
}

/** Exposto para o gerador de dashboard saber qual diretório ler. */
export function currentExecutionId(): string {
  return executionId();
}
