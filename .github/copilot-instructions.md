---
# GitHub Copilot — Instruções do Repositório QA Mobile
# Aplicado automaticamente em code reviews, sugestões e chat no contexto deste repo.
---

## Contexto

Este repositório automatiza **testes mobile (Android/iOS) do app Flutter Youse** usando **WebdriverIO + Appium + TypeScript**.
Cobre fluxo de cotação Auto, login/logout, pós-contratação (Minha Conta) e acessibilidade nativa (TalkBack/VoiceOver).

**NÃO** há automação de browser aqui — para E2E web, ver `qa-e2e-tests-automation`.

## Arquitetura

```
tests/
  pages/             ← Screen Objects (1 classe por tela nativa)
    quotation/       ← LeadInfoScreen, VehicleDetailsScreen, CheckoutScreen, etc.
    HomeScreen.ts
    AccountScreen.ts
  helpers/
    selectors.ts     ← objeto A11y com todos os labels de content-desc
    a11y.ts          ← runA11yAudit, expectA11yPassed, LEAD_MATRIX, etc.
    funnel.ts        ← runFunnelToCheckout() — navega o funil completo
    waits.ts         ← resetAppForE2e, waitForAppReady
  data/
    testData.ts      ← generateMobileTestData()
  spec/
    smoke/           ← @smoke — telas básicas sem navegação complexa
    e2e/             ← @e2e — fluxos completos (cotação, vistoria, login)
    a11y/            ← @a11y — acessibilidade nativa (TalkBack/VoiceOver)
```

## Regras obrigatórias ao revisar ou gerar código

### WDIO / Appium

- **NUNCA** use `driver.pause()` ou `browser.pause()` — use `waitUntil`, `waitForExist`, ou helpers em `tests/helpers/waits.ts`.
- **NUNCA** use `it.only` ou `describe.only` — bloqueia a suíte no CI.
- **PREFIRA** seletores de acessibilidade:
  - Android: `$('~accessibilityLabel')` ou `byDescContains('label')` (helper que usa `UiSelector().descriptionContains()`)
  - iOS: `$('~accessibilityLabel')`
  - **EVITE** XPath: `$('//android.widget.TextView[...]')` — frágil e lento.
- **SEMPRE** use `this.timeout(ms)` no `before` e `it` — sem timeout padrão em WDIO/Mocha.
- Screen Objects usam `driver` global — não passe `driver` como parâmetro.

### Funil de cotação

- **SEMPRE** use `runFunnelToCheckout(options?)` de `tests/helpers/funnel.ts` para navegar o funil completo.
  - Aceita `{ licensePlate }` para cenários de vistoria.
  - Retorna `CheckoutScreen` com cartão já preenchido.
- **NUNCA** repita as 7 etapas do funil inline na spec.

### Acessibilidade (A11y)

- Ferramenta: **Appium content-desc / accessibility-id** (TalkBack/VoiceOver) — **NÃO** usa axe DOM.
  - axe DOM é domínio do `qa-e2e-tests-automation`.
- Use `runA11yAudit(MATRIX)` + `expectA11yPassed(report)` do `tests/helpers/a11y.ts`.
- Cada nova tela com interação acessível precisa de entrada no objeto `A11y` em `tests/helpers/selectors.ts`.
- Spec canônico do funil a11y: `tests/spec/a11y/funnel.a11y.spec.ts` — não crie specs isolados por tela.

### Estrutura de specs

```
tests/spec/
  smoke/             → @smoke — home, launch, elementos básicos
  e2e/               → @e2e  — cotacaoAuto, vistoriaOnline, loginLogout, postContratacao
  a11y/              → @a11y — funnel.a11y (canônico), home.a11y, home-logged-in.a11y
```

Todo novo `.spec.ts` precisa de tag `@smoke`, `@e2e` ou `@a11y`.

### Dados de teste

- Use `generateMobileTestData()` de `tests/data/testData.ts` — nunca dados hardcoded na spec.
- Placa de vistoria online: `plate.onlineInspection.number` (YOU-0020)
- Placa de vistoria por vídeo: `plate.videoInspection.number` (YOU-0023)
- **NUNCA** hardcode CPF real, e-mail pessoal ou token.
