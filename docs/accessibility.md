# Acessibilidade Mobile — guia rápido

Suíte de testes de **acessibilidade mobile** (WCAG 2.2 AA + W3C Mobile Accessibility) acoplada ao mesmo runner Appium/WebdriverIO. Combina o [Google Accessibility Test Framework](https://github.com/google/Accessibility-Test-Framework-for-Android) (via `mobile: performAccessibilityAudit`) com checks manuais cross-platform e contraste pixel-perfect via screenshot.

| Plataforma | Audit nativo  | Contraste pixel-perfect | Dynamic Type | Orientação |
| ---------- | ------------- | ----------------------- | ------------ | ---------- |
| Android    | ✅ Google ATF | ✅ pngjs                | ✅ adb       | ✅         |
| iOS        | ❌ (manual)   | ✅ pngjs                | ⚠️ manual    | ✅         |

> Para iOS, o ATF não roda — mas labels, touch target, foco, orientação e contraste continuam automatizados.

## Como executar

```bash
# Smoke a11y — valida apenas a Home (rápido, GATE DE PR)
npm run test:a11y:smoke:android
npm run test:a11y:smoke:ios

# Suíte completa a11y (Home + funil Lead + Veículo)
npm run test:a11y:android
npm run test:a11y:ios
```

Pré-requisitos idênticos aos demais testes mobile: emulador/dispositivo, APK/`.app` em `apps/`, Appium drivers instalados (`npm run appium:doctor`).

> **Importante:** este projeto depende de `pngjs` para a checagem de contraste pixel-perfect. Após pull, rode `npm install`. Se a dep não estiver instalada, o check de contraste vira `info` (não bloqueia).

## Pilares cobertos

| Pilar                   | Referência                    | Como funciona                                                                                                                                                                                                |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Labels**              | WCAG 1.1.1 / 4.1.2            | Cada elemento da matriz precisa expor `content-desc` (Android) ou `accessibility label` (iOS) não vazio.                                                                                                     |
| **Touch target**        | WCAG 2.5.5 + Material 3 + HIG | Tamanho mínimo de 48dp (Android) / 44pt (iOS), calculado a partir de `displayDensity`.                                                                                                                       |
| **Ordem de foco**       | WCAG 2.4.3                    | Ordem dos elementos na árvore de a11y casa com a ordem visual (top-to-bottom, left-to-right).                                                                                                                |
| **Contraste**           | WCAG 1.4.3                    | (1) Google ATF reporta `TextContrastCheck`/`ImageContrastCheck` no Android. (2) Pixel-perfect: captura screenshot, amostra cores do contorno (fundo) vs interior (texto/ícone) e calcula ratio WCAG. ≥ 4.5:1 |
| **Dynamic Type**        | WCAG 1.4.4                    | Aplica `font_scale=1.3` via `adb shell` e verifica que labels permanecem visíveis. Restaura ao final.                                                                                                        |
| **Orientação**          | WCAG 1.3.4                    | Gira para landscape e re-verifica os labels.                                                                                                                                                                 |
| **Teclado**             | WCAG 2.1.1 / 2.1.2            | Para cada input, foca via tap e dispara `KEYCODE_TAB` para garantir avanço de foco sem trap.                                                                                                                 |
| **Gestos alternativos** | WCAG 2.5.1                    | Cada ação com gesto complexo precisa ter um botão equivalente acessível.                                                                                                                                     |
| **Dark mode**           | WCAG 1.4.3 + 1.4.11           | Alterna o tema do sistema (Android: `cmd uimode night yes`) e verifica que labels seguem visíveis — detecta apps Flutter que ignoram `MediaQuery.platformBrightness`.                                        |

## CI / gates de PR

| Job                  | Quando roda                                          | O que executa                              |
| -------------------- | ---------------------------------------------------- | ------------------------------------------ |
| `validate`           | Todo PR + push em main                               | typecheck + lint + format                  |
| `test-android-a11y`  | **Todo PR** + push em main                           | Smoke a11y Home (gate de PR — WCAG 2.2 AA) |
| `test-android-smoke` | Push em main / dispatch                              | Smoke funcional + suíte a11y completa      |
| `test-ios-smoke`     | Push em main / dispatch (`platform=ios`) em macOS-14 | Smoke a11y Home em simulador iPhone        |

Secrets necessários:

- `MOBILE_APK_BASE64` — APK Android codificado em base64 (obrigatório para o gate de a11y rodar)
- `MOBILE_APP_IOS_BASE64` — `.app` iOS Simulator empacotado em `.tar.gz` e codificado em base64
- `IOS_BUNDLE_ID` (opcional, default `io.youse.app`)
- `ANDROID_APP_PACKAGE`, `ANDROID_APP_ACTIVITY` (opcionais)

Sem secret, o job exibe `::warning::` e passa — não bloqueia PRs até o time configurar.

## Como adicionar uma tela nova

1. Mapeie os labels relevantes em `tests/helpers/selectors.ts` (constante `A11y`).
2. Crie a matriz em `tests/helpers/a11y/matrix.ts`:

   ```ts
   export const MINHA_TELA_MATRIX: A11yScreenMatrix = {
     name: 'MinhaTela',
     expectedLabels: [A11y.tituloDaTela, A11y.btnContinuar],
     inputs: [A11y.inputAlgo],
     gestureAlternatives: [A11y.btnContinuar],
     // Opcional: excluir ícones decorativos do contraste pixel-perfect
     contrastTargets: [A11y.tituloDaTela, A11y.btnContinuar],
     contrastThreshold: 4.5, // default WCAG AA texto normal
   };
   ```

3. Crie o spec em `tests/spec/a11y/<minhaTela>.a11y.spec.ts`:

   ```ts
   import { MINHA_TELA_MATRIX, expectA11yPassed, runA11yAudit, summarize } from '../../helpers/a11y';

   describe('A11y — MinhaTela @a11y @mobile', () => {
     before(async () => {
       /* navegar até a tela */
     });

     it('atende critérios de a11y', async () => {
       const report = await runA11yAudit(MINHA_TELA_MATRIX);
       console.log(summarize(report));
       expectA11yPassed(report);
     });
   });
   ```

## Integrando ao E2E

Para auditar uma tela já carregada dentro de um spec existente (ex.: `cotacaoAuto.spec.ts`), use o helper `auditCurrentScreen` (não interrompe o teste E2E, apenas registra warning):

```ts
import { auditCurrentScreen, CHECKOUT_MATRIX } from '../../helpers/a11y';

// ... dentro do it() ...
await checkoutScreen.waitForLoaded();
await auditCurrentScreen(CHECKOUT_MATRIX); // não-bloqueante
```

Se quiser **bloquear** o E2E quando houver erro crítico de a11y, use `runA11yAudit` + `expectA11yPassed`:

```ts
import { runA11yAudit, expectA11yPassed, CHECKOUT_MATRIX } from '../../helpers/a11y';

const a11yReport = await runA11yAudit(CHECKOUT_MATRIX);
expectA11yPassed(a11yReport);
```

O report fica anexo no Allure como JSON + descrição markdown e também é persistido em `reports/a11y/{executionId}/{tela}-{platform}.json` para alimentar o dashboard.

## Dashboard A11y

Cada execução escreve um report JSON em `reports/a11y/{executionId}/`. O comando `npm run mobile:a11y:report` consolida tudo em:

- [`docs/reports/mobile-a11y-dashboard.md`](reports/mobile-a11y-dashboard.md) — histórico tabular
- [`docs/reports/mobile-a11y-latest.md`](reports/mobile-a11y-latest.md) — findings detalhados da última run
- [`docs/reports/mobile-a11y-latest.html`](reports/mobile-a11y-latest.html) — **versão web standalone** (KPIs, sparklines, tabela)
- [`docs/reports/mobile-a11y-latest.json`](reports/mobile-a11y-latest.json) — machine-readable
- [`docs/reports/mobile-a11y-log.json`](reports/mobile-a11y-log.json) — índice acumulado (100 últimas)
- `docs/reports/history/a11y-{id}/` — snapshot por execução

Fluxo recomendado:

```bash
# Rodar a suíte e gerar dashboard de uma vez
npm run test:a11y:report:android

# Ou regenerar dashboards a partir dos JSONs já capturados
npm run mobile:a11y:report -- --device "Pixel 7" --android 14
```

No CI, cada job a11y faz upload do dashboard como artifact (`a11y-dashboard-pr`, `a11y-dashboard-full`, `a11y-dashboard-ios`).

## Contraste pixel-perfect — detalhes

A checagem implementada em [tests/helpers/a11y/contrast.ts](../tests/helpers/a11y/contrast.ts) faz:

1. `driver.takeScreenshot()` → PNG base64.
2. Decodifica com `pngjs` (sem deps nativas).
3. Para cada label: obtém bounding rect, amostra pixels da borda (fundo) e do interior (texto/ícone).
4. Reduz ruído por clustering em buckets de 16 níveis por canal.
5. Calcula razão de contraste pela fórmula WCAG (luminância relativa).
6. Compara contra o threshold (default 4.5:1):
   - `< threshold/2` → **error** (crítico, ilegível)
   - `< threshold` → **warning**
   - `≥ threshold` → **info**

Falsos positivos comuns:

- Ícones decorativos sobre imagem/gradiente → exclua via `contrastTargets`.
- Texto em estado de loading/skeleton → adicione `await screen.waitForLoaded()` antes do audit.

## Severidades

- `error` — quebra o spec via `expectA11yPassed`. Use para regressões bloqueantes (label ausente, foco quebrado, contraste crítico).
- `warning` — reportado, não quebra. Inclui touch target abaixo do mínimo, ordem visual divergente, contraste subótimo.
- `info` — contexto/cobertura (ex.: contraste validado OK; lib indisponível).

## Próximos passos sugeridos

- Adicionar visual regression com `pixelmatch` comparando screenshots PR vs baseline da `main` (complementa o contraste).
- Integrar Accessibility Inspector da Apple em pipeline manual macOS para auditoria visual de TraitChanges (escuro/claro, redução de movimento).
- Publicar `mobile-a11y-latest.html` no GitHub Pages (adicionar step `actions/deploy-pages@v4` no CI).
- Replicar o helper `checkDarkMode` no `qa-e2e-tests-automation` usando `page.emulateMedia({ colorScheme: 'dark' })`.
