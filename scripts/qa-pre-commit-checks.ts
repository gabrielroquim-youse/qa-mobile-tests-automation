/**
 * QA Pre-Commit / PR Checks  --  Mobile (WebdriverIO + Appium)
 * ---------------------------------------------------------------------------
 * Bateria de validações automáticas com dois modos de operação:
 *
 *   LOCAL (pre-commit)  -> analisa arquivos STAGED (`git diff --cached`)
 *   CI    (PR check)    -> analisa arquivos modificados no PR via env PR_BASE
 *                         PR_BASE=origin/main ts-node qa-pre-commit-checks.ts
 *
 * Cada check segue o contrato:
 *   - name:     título exibido no relatório
 *   - level:    'error' (bloqueia commit/PR) | 'warn' (apenas alerta)
 *   - run():    retorna lista de violações (string[])
 *
 * Os checks são adaptados para o contexto mobile:
 *   - WDIO + Appium (driver.pause, $('~'), accessibility IDs)
 *   - Mocha (it.only / describe.only  --  sem test.only)
 *   - Sem Playwright browser (não há waitForTimeout, getByRole, etc.)
 * ---------------------------------------------------------------------------
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { extname, resolve } from 'path';

// - Modos de operação -

const REPO_ROOT = resolve(__dirname, '..');
const PR_BASE = process.env['PR_BASE'];
const REPORT_JSON = process.env['QA_REPORT_JSON'];
const IS_CI = Boolean(PR_BASE);

// - Terminal colors -

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};
const NO_COLOR = IS_CI || Boolean(process.env['NO_COLOR']);
const c = (color: keyof typeof COLORS, text: string): string => (NO_COLOR ? text : `${COLORS[color]}${text}${COLORS.reset}`);

// - Tipos -

type CheckLevel = 'error' | 'warn';

interface CheckResult {
  name: string;
  level: CheckLevel;
  violations: string[];
  checklistItem?: string;
}

interface Check {
  name: string;
  level: CheckLevel;
  checklistItem?: string;
  run: (ctx: Context) => string[];
}

interface Context {
  stagedFiles: string[];
  newFiles: string[];
}

// - Listagem de arquivos -

function getFiles(): { staged: string[]; added: string[] } {
  const cmd = IS_CI
    ? `git diff --name-status --diff-filter=ACMR ${PR_BASE}...HEAD`
    : 'git diff --cached --name-status --diff-filter=ACMR';

  const out = execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' });
  const staged: string[] = [];
  const added: string[] = [];
  for (const line of out.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const status = parts[0];
    const file = parts[parts.length - 1];
    staged.push(file);
    if (status === 'A') added.push(file);
  }
  return { staged, added };
}

// - Leitura de conteúdo -

function readContent(file: string): string | null {
  try {
    if (IS_CI) {
      const abs = resolve(REPO_ROOT, file);
      if (!existsSync(abs)) return null;
      return readFileSync(abs, 'utf8');
    }
    return execSync(`git show :"${file}"`, { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch {
    return null;
  }
}

// - Helper: busca por regex em arquivos -

function findMatches(files: string[], pattern: RegExp, opts?: { onlyExt?: string[]; skipComments?: boolean }): string[] {
  const hits: string[] = [];
  for (const file of files) {
    if (opts?.onlyExt && !opts.onlyExt.includes(extname(file))) continue;
    const content = readContent(file);
    if (!content) continue;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const prev = i > 0 ? lines[i - 1] : '';
      if (opts?.skipComments && /^\s*(\/\/|\*|#)/.test(line)) continue;
      if (/eslint-disable(-next-line)?/.test(prev)) continue;
      const re = new RegExp(pattern.source, pattern.flags.replace('g', ''));
      if (re.test(line)) hits.push(`${file}:${i + 1} -> ${line.trim().slice(0, 120)}`);
    }
  }
  return hits;
}

// - Checks -

const CHECKS: Check[] = [
  // - Segurança / LGPD -
  {
    name: 'Bloqueia arquivos .env (exceto .env.example)',
    level: 'error',
    checklistItem: 'Nenhum dado sensível foi inserido',
    run: ({ stagedFiles }) =>
      stagedFiles
        .filter((f) => /(^|\/)\.env(\.[\w-]+)?$/.test(f) && !/\.env\.example$/.test(f))
        .map((f) => `Arquivo proibido: ${f}`),
  },
  {
    name: 'Bloqueia artefatos de execução na raiz (.log, .png, .mp4, .zip)',
    level: 'error',
    run: ({ stagedFiles }) =>
      stagedFiles
        .filter((f) => /^[^/]+\.(log|png|jpe?g|mp4|webm|zip|har|trace)$/i.test(f))
        .map((f) => `Artefato local na raiz: ${f}  --  adicione ao .gitignore ou mova para docs/`),
  },
  {
    name: 'Detecta secrets / tokens / API keys em texto claro',
    level: 'error',
    checklistItem: 'Nenhum dado sensível foi inserido',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => /\.(ts|js|json|ya?ml|md|env\.example)$/i.test(f)),
        /(api[_-]?key|secret|token|password|bearer|authorization)\s*[:=]\s*['"`][^'"`\s]{12,}['"`]/i,
      ).filter((hit) => !/example|placeholder|<your|xxx+/i.test(hit)),
  },
  {
    name: 'Detecta CPFs reais hardcoded (LGPD)',
    level: 'warn',
    checklistItem: 'Nenhum dado sensível foi inserido',
    run: ({ stagedFiles }) => {
      const re = /\b(?!000\.?000\.?000)(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/;
      return findMatches(
        stagedFiles.filter((f) => /\.(ts|js|json)$/i.test(f) && !/cpf-cnpj-validator|fixtures|data\//i.test(f)),
        re,
      );
    },
  },
  {
    name: 'Detecta e-mails pessoais (gmail/hotmail/yahoo/outlook)  --  LGPD',
    level: 'warn',
    checklistItem: 'Nenhum dado sensível foi inserido',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => /\.(ts|js|json|md)$/i.test(f)),
        /[\w.+-]+@(gmail|hotmail|yahoo|outlook|live|icloud)\.com/i,
      ),
  },

  // - Antipadrões WDIO / Appium -
  {
    name: 'Sem driver.pause() / browser.pause()  --  prefira waitForLoaded() ou waitForExist()',
    level: 'error',
    checklistItem: 'Não há esperas fixas (driver.pause)',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => f.startsWith('tests/') && f.endsWith('.ts')),
        /\b(driver|browser)\.pause\s*\(/,
        { skipComments: true },
      ),
  },
  {
    name: 'Sem it.only / describe.only (Mocha)',
    level: 'error',
    checklistItem: 'Não há it.only ou describe.only',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => f.startsWith('tests/') && f.endsWith('.ts')),
        /\b(it|describe)\.only\s*\(/,
      ),
  },
  {
    name: 'Evita seletores XPath  --  prefira $("~accessibilityId") ou byDescContains()',
    level: 'warn',
    checklistItem: 'Seletores usam accessibility IDs',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => /^tests\/spec\/.+\.spec\.ts$/.test(f)),
        /\$\(\s*['"`](\/\/|xpath=)/,
        { skipComments: true },
      ),
  },
  {
    name: 'console.log/debug esquecido (prefira console.info ou Allure attachments)',
    level: 'warn',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => f.startsWith('tests/') && /\.ts$/.test(f)),
        /^\s*console\.(log|debug)\(/,
        { skipComments: true },
      ),
  },

  // - Tags obrigatórias em novos specs -
  {
    name: 'Novos specs precisam de tag (@smoke|@e2e|@a11y|@mobile)',
    level: 'error',
    checklistItem: 'Tags foram adicionadas corretamente',
    run: ({ newFiles }) => {
      const tagRe = /@(smoke|e2e|a11y|mobile)\b/;
      return newFiles
        .filter((f) => /^tests\/spec\/.+\.spec\.ts$/.test(f))
        .filter((f) => !tagRe.test(readContent(f) ?? ''))
        .map((f) => `Spec sem tag conhecida: ${f}`);
    },
  },

  // - Spec no diretório correto -
  {
    name: 'Spec no diretório correto conforme tag (@smoke->smoke/ @e2e->e2e/ @a11y->a11y/)',
    level: 'warn',
    checklistItem: 'Spec no diretório correto',
    run: ({ stagedFiles }) => {
      const violations: string[] = [];
      for (const f of stagedFiles.filter((f) => /^tests\/spec\/.+\.spec\.ts$/.test(f))) {
        const content = readContent(f) ?? '';
        const tagMap: Record<string, string> = { '@smoke': 'smoke/', '@e2e': 'e2e/', '@a11y': 'a11y/' };
        for (const [tag, dir] of Object.entries(tagMap)) {
          if (content.includes(tag) && !f.includes(dir)) {
            violations.push(`${f} tem tag ${tag} mas está fora de tests/spec/${dir}`);
          }
        }
      }
      return violations;
    },
  },

  // - Debug code residual -
  {
    name: 'Sem debugger; no código fonte',
    level: 'error',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => /\.(ts|js)$/i.test(f)),
        /^\s*debugger\s*;?\s*$/,
      ),
  },

  // - Tamanho de arquivo -
  {
    name: 'Arquivo > 500 KB (suspeito de binário/log)',
    level: 'warn',
    run: ({ stagedFiles }) => {
      const big: string[] = [];
      for (const f of stagedFiles) {
        const abs = resolve(REPO_ROOT, f);
        if (!existsSync(abs)) continue;
        try {
          const size = statSync(abs).size;
          if (size > 500 * 1024) big.push(`${f} (${(size / 1024).toFixed(0)} KB)`);
        } catch { /* ignore */ }
      }
      return big;
    },
  },

  // - TODO/FIXME sem ticket Jira -
  {
    name: 'TODO/FIXME deve referenciar ticket Jira (ex: TODO POSV-123)',
    level: 'warn',
    run: ({ stagedFiles }) =>
      findMatches(
        stagedFiles.filter((f) => /\.(ts|js|md)$/i.test(f) && !/scripts\/qa-/.test(f)),
        /^\s*(\/\/|\*|#).*\b(TODO|FIXME|XXX)\b(?!.{0,40}[A-Z]{2,}-\d+)/,
      ),
  },
];

// - Runner -

function main(): number {
  const { staged, added } = getFiles();
  const mode = IS_CI ? `CI (diff vs ${PR_BASE})` : 'local (staged)';

  if (staged.length === 0) {
    console.log(c('gray', `> Nenhum arquivo alterado [${mode}]  --  pulando checks Youse.`));
    return 0;
  }

  if (!IS_CI) {
    console.log('');
    console.log(c('bold', '[??] QA Pre-Commit Checks  --  Mobile (Youse)'));
    console.log(c('gray', `   ${staged.length} arquivo(s) staged . ${added.length} novo(s)`));
    console.log('');
  }

  const ctx: Context = { stagedFiles: staged, newFiles: added };
  const results: CheckResult[] = [];

  for (const check of CHECKS) {
    const violations = check.run(ctx);
    results.push({ name: check.name, level: check.level, violations, checklistItem: check.checklistItem });

    if (!IS_CI) {
      const icon = violations.length === 0 ? c('green', 'OK ') : check.level === 'error' ? c('red', 'XX ') : c('yellow', '!');
      const tag =
        violations.length === 0
          ? c('green', 'OK')
          : check.level === 'error'
            ? c('red', `FAIL (${violations.length})`)
            : c('yellow', `WARN (${violations.length})`);
      console.log(`  ${icon} ${check.name}  ${c('dim', '.')} ${tag}`);
      for (const v of violations.slice(0, 5)) console.log(c('gray', `        -  ${v}`));
      if (violations.length > 5) console.log(c('gray', `        -  ... +${violations.length - 5} ocorrencia(s)`));
    }
  }

  const errors = results.filter((r) => r.level === 'error' && r.violations.length > 0);
  const warns = results.filter((r) => r.level === 'warn' && r.violations.length > 0);

  if (IS_CI || REPORT_JSON) {
    const json = JSON.stringify({ results, summary: { errors: errors.length, warns: warns.length, passed: results.length - errors.length - warns.length } }, null, 2);
    if (REPORT_JSON) writeFileSync(REPORT_JSON, json, 'utf8');
    else console.log(json);
    return errors.length > 0 ? 1 : 0;
  }

  console.log('');
  if (errors.length === 0 && warns.length === 0) {
    console.log(c('green', '[OK] Todos os checks passaram.'));
    return 0;
  }

  if (warns.length > 0 && errors.length === 0) {
    console.log(c('yellow', `[!]  ${warns.length} aviso(s)  --  verifique antes de prosseguir.`));
    return 0;
  }

  console.log(c('red', `XX  ${errors.length} erro(s) bloqueiam o commit. Corrija e tente novamente.`));
  console.log(c('gray', '  Para pular em emergencia: git commit --no-verify'));
  return 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(c('red', 'XX  Erro inesperado nos checks:'), err);
  process.exit(0);
}
