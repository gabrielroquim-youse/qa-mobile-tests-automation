/**
 * Renderiza o dashboard A11y como HTML standalone (sem dependências externas),
 * pronto para abrir no navegador ou publicar como GitHub Pages.
 */
import type { A11yLogEntry } from './a11yHistory';

const COLORS = {
  passed: '#16a34a',
  warning: '#d97706',
  failed: '#dc2626',
  bg: '#0f172a',
  card: '#1e293b',
  border: '#334155',
  text: '#e2e8f0',
  muted: '#94a3b8',
  accent: '#38bdf8',
};

function statusColor(status: A11yLogEntry['status']): string {
  return COLORS[status];
}

function statusLabel(status: A11yLogEntry['status']): string {
  return status === 'passed' ? '✅ Passou' : status === 'warning' ? '⚠️ Warnings' : '❌ Falhou';
}

function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sparkline(values: number[], color: string): string {
  if (values.length === 0) return '';
  const width = 120;
  const height = 32;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - (v / max) * height).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" aria-hidden="true">
    <polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" />
  </svg>`;
}

export function renderA11yDashboardHtml(entries: A11yLogEntry[]): string {
  const latest = entries[0];
  const errorsSeries = entries
    .slice(0, 20)
    .reverse()
    .map((e) => e.totals.errors);
  const warningsSeries = entries
    .slice(0, 20)
    .reverse()
    .map((e) => e.totals.warnings);
  const findingsSeries = entries
    .slice(0, 20)
    .reverse()
    .map((e) => e.totals.findings);

  const ruleRows = latest
    ? Object.entries(latest.byRule)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(
          ([rule, counts]) =>
            `<tr>
              <td><code>${escapeHtml(rule)}</code></td>
              <td class="num err">${counts.errors}</td>
              <td class="num warn">${counts.warnings}</td>
              <td class="num info">${counts.infos}</td>
            </tr>`,
        )
        .join('')
    : '';

  const screenRows = latest
    ? latest.screens
        .map(
          (s) =>
            `<tr>
              <td>${escapeHtml(s.screen)}</td>
              <td>${escapeHtml(s.platform)}</td>
              <td class="num err">${s.errors}</td>
              <td class="num warn">${s.warnings}</td>
              <td class="num info">${s.infos}</td>
              <td>${s.passed ? '✅' : '❌'}</td>
            </tr>`,
        )
        .join('')
    : '';

  const runRows = entries
    .map(
      (entry, index) =>
        `<tr>
          <td class="num">#${entries.length - index}</td>
          <td>${escapeHtml(entry.generatedAt.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'))}</td>
          <td>${escapeHtml(entry.platform)}</td>
          <td>${escapeHtml(entry.device.label)}</td>
          <td class="num">${entry.totals.screens}</td>
          <td class="num err">${entry.totals.errors}</td>
          <td class="num warn">${entry.totals.warnings}</td>
          <td class="num info">${entry.totals.infos}</td>
          <td><span class="badge" style="background:${statusColor(entry.status)}1a;color:${statusColor(entry.status)};border-color:${statusColor(entry.status)}55">${statusLabel(entry.status)}</span></td>
          <td><a href="${escapeHtml(entry.historyPath)}/">${escapeHtml(entry.executionId)}</a></td>
        </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-br">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Mobile A11y Dashboard · Youse</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: ${COLORS.bg}; color: ${COLORS.text}; line-height: 1.5; }
  header { padding: 32px 24px 16px; max-width: 1200px; margin: 0 auto; }
  header h1 { margin: 0 0 8px; font-size: 28px; }
  header p { color: ${COLORS.muted}; margin: 0; }
  main { max-width: 1200px; margin: 0 auto; padding: 16px 24px 48px; }
  section { background: ${COLORS.card}; border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
  section h2 { margin: 0 0 16px; font-size: 18px; color: ${COLORS.accent}; }
  .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
  .kpi { background: ${COLORS.bg}; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 16px; }
  .kpi-label { color: ${COLORS.muted}; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; }
  .kpi-value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .kpi-trend { margin-top: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid ${COLORS.border}; }
  th { color: ${COLORS.muted}; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.06em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.err { color: ${COLORS.failed}; font-weight: 600; }
  td.warn { color: ${COLORS.warning}; font-weight: 600; }
  td.info { color: ${COLORS.accent}; }
  code { background: ${COLORS.bg}; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  a { color: ${COLORS.accent}; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; border: 1px solid; }
  .scroll { overflow-x: auto; }
  footer { text-align: center; color: ${COLORS.muted}; font-size: 12px; padding: 16px; }
</style>
</head>
<body>
<header>
  <h1>Mobile A11y Dashboard</h1>
  <p>WCAG 2.2 AA · Appium + WebdriverIO · espelha o padrão <code>qa-e2e-tests-automation</code></p>
</header>
<main>
  <section>
    <h2>Visão geral · última execução</h2>
    ${
      latest
        ? `<div class="kpi-grid">
            <div class="kpi">
              <div class="kpi-label">Status</div>
              <div class="kpi-value" style="color:${statusColor(latest.status)}">${statusLabel(latest.status)}</div>
              <div class="kpi-trend">${escapeHtml(latest.generatedAt.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC'))}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Telas auditadas</div>
              <div class="kpi-value">${latest.totals.screens}</div>
              <div class="kpi-trend">${escapeHtml(latest.device.label)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">❌ Erros</div>
              <div class="kpi-value" style="color:${COLORS.failed}">${latest.totals.errors}</div>
              <div class="kpi-trend">${sparkline(errorsSeries, COLORS.failed)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">⚠️ Warnings</div>
              <div class="kpi-value" style="color:${COLORS.warning}">${latest.totals.warnings}</div>
              <div class="kpi-trend">${sparkline(warningsSeries, COLORS.warning)}</div>
            </div>
            <div class="kpi">
              <div class="kpi-label">Findings totais</div>
              <div class="kpi-value">${latest.totals.findings}</div>
              <div class="kpi-trend">${sparkline(findingsSeries, COLORS.accent)}</div>
            </div>
          </div>`
        : '<p>Sem execução registrada ainda. Rode <code>npm run test:a11y:smoke:android</code>.</p>'
    }
  </section>

  ${
    latest
      ? `<section>
          <h2>Resultado por tela</h2>
          <div class="scroll">
            <table>
              <thead><tr><th>Tela</th><th>Plataforma</th><th>❌</th><th>⚠️</th><th>ℹ️</th><th>Status</th></tr></thead>
              <tbody>${screenRows}</tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Distribuição por regra (WCAG)</h2>
          <div class="scroll">
            <table>
              <thead><tr><th>Regra</th><th>❌</th><th>⚠️</th><th>ℹ️</th></tr></thead>
              <tbody>${ruleRows}</tbody>
            </table>
          </div>
        </section>`
      : ''
  }

  <section>
    <h2>Histórico (${entries.length} execução(ões))</h2>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>#</th><th>Execução</th><th>Plataforma</th><th>Device</th>
            <th>Telas</th><th>❌</th><th>⚠️</th><th>ℹ️</th><th>Status</th><th>Snapshot</th>
          </tr>
        </thead>
        <tbody>${runRows}</tbody>
      </table>
    </div>
  </section>
</main>
<footer>
  Gerado por <code>npm run mobile:a11y:report</code> · ${escapeHtml(new Date().toISOString())}
</footer>
</body>
</html>
`;
}
