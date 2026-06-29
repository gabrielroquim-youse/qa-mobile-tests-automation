/**
 * QA Commit Message Validator
 * ---------------------------------------------------------------------------
 * Valida a mensagem de commit conforme as convenções da Youse:
 *
 *   1. Padrão Conventional Commits:
 *        type(scope?): subject
 *      Tipos aceitos: feat, fix, refactor, chore, docs, test, perf, ci, build,
 *                     style, revert.
 *
 *   2. Subject (título) em PT-BR, imperativo, ≤ 72 caracteres.
 *
 *   3. Corpo opcional  --  separado por linha em branco.
 *
 *   4. Evita misturar inglês/português no título (heurística simples para
 *      palavras inglesas comuns).
 *
 *   5. Permite mensagens automáticas (merge, revert, fixup, squash) sem
 *      reclamar.
 *
 * Uso (via husky commit-msg):
 *   ts-node scripts/qa-commit-msg.ts "$1"
 * ---------------------------------------------------------------------------
 */

import { readFileSync } from 'fs';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};
const c = (color: keyof typeof COLORS, text: string): string => `${COLORS[color]}${text}${COLORS.reset}`;

const ALLOWED_TYPES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'perf', 'ci', 'build', 'style', 'revert'];

const HEADER_RE = new RegExp(`^(${ALLOWED_TYPES.join('|')})(\\([\\w\\-./ ]+\\))?(!)?:\\s.+`);

// Palavras em inglês comuns que sinalizam mistura de idiomas no título.
const ENGLISH_WORDS = [
  'add', 'added', 'adding', 'remove', 'removed', 'update', 'updated',
  'fix', 'fixed', 'create', 'created', 'change', 'changed', 'improve',
  'improved', 'support', 'supports', 'new', 'old', 'release', 'merge',
  'when', 'while', 'with', 'without', 'and', 'the', 'check', 'checks',
  'use', 'using', 'made', 'make', 'building', 'build', 'tests',
];

function isAutoMessage(msg: string): boolean {
  return /^(Merge|Revert|fixup!|squash!|amend!|Initial commit)/i.test(msg.trimStart());
}

function checkEnglishLeak(subject: string): string[] {
  const lower = subject.toLowerCase().replace(/[^\p{L}\s]/gu, ' ');
  const tokens = lower.split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => ENGLISH_WORDS.includes(t));
  return Array.from(new Set(hits));
}

function main(): number {
  const file = process.argv[2];
  if (!file) {
    console.error(c('red', 'XX  Caminho da mensagem de commit não informado.'));
    return 1;
  }

  const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, ''); // strip BOM
  const lines = raw.split('\n').filter((l) => !/^#/.test(l));
  const header = lines[0] ?? '';

  if (isAutoMessage(header)) {
    return 0;
  }

  const errors: string[] = [];
  const warns: string[] = [];

  // 1. Padrão Conventional Commits
  if (!HEADER_RE.test(header)) {
    errors.push(
      `Título fora do padrão Conventional Commits.\n` +
        `   Esperado: ${c('bold', 'type(scope?): descrição em pt-br')}\n` +
        `   Tipos válidos: ${ALLOWED_TYPES.join(', ')}\n` +
        `   Recebido: "${header}"`,
    );
  }

  // 2. Tamanho do título
  if (header.length > 72) {
    errors.push(`Título com ${header.length} caracteres (máx. 72). Resuma ou mova detalhes para o corpo.`);
  }

  // 3. Mistura de idiomas (apenas warn)
  const colonIdx = header.indexOf(':');
  const subject = colonIdx >= 0 ? header.slice(colonIdx + 1).trim() : header;
  const englishHits = checkEnglishLeak(subject);
  if (englishHits.length >= 2) {
    warns.push(`Possível mistura de idiomas no título: ${englishHits.join(', ')}. Escreva 100% em PT-BR.`);
  }

  // 4. Segunda linha deve estar em branco (se houver corpo)
  if (lines.length > 1 && lines[1].trim() !== '') {
    errors.push('A segunda linha deve estar em branco, separando título e corpo.');
  }

  // - Saída -
  if (errors.length === 0 && warns.length === 0) {
    console.log(c('green', 'OK  Mensagem de commit dentro do padrão Youse.'));
    return 0;
  }

  console.log('');
  console.log(c('bold', '📝 QA Commit-Msg Check'));
  console.log(c('gray', `   ${header}`));
  console.log('');
  for (const e of errors) console.log(`  ${c('red', 'XX ')} ${e}`);
  for (const w of warns) console.log(`  ${c('yellow', '!')} ${w}`);

  if (errors.length > 0) {
    console.log('');
    console.log(c('gray', '   Exemplo válido:'));
    console.log(c('gray', '     feat(mobile): adiciona tela de vistoria online nativa'));
    console.log(c('gray', '     fix(a11y): corrige content-desc ausente no botão de cotação'));
    console.log('');
    return 1;
  }

  console.log('');
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(c('red', 'XX  Erro inesperado na validação da mensagem:'), err);
  process.exit(0);
}
