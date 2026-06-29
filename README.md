# QA Mobile Tests Automation

Suite de testes automatizados **mobile** (Android/iOS) da Youse Seguradora, usando **Appium** + **WebdriverIO** + **TypeScript**.

Projeto irmão do [qa-e2e-tests-automation](../qa-e2e-tests-automation) (Playwright/web).

---

## Stack

| Ferramenta                             | Finalidade                   |
| -------------------------------------- | ---------------------------- |
| [Appium 2](https://appium.io/)         | Automação nativa Android/iOS |
| [WebdriverIO 9](https://webdriver.io/) | Runner e API de testes       |
| TypeScript                             | Linguagem                    |
| Mocha                                  | Framework de specs           |
| Allure                                 | Relatórios                   |

---

## Estrutura

```text
qa-mobile-tests-automation/
├── apps/                         # APK/IPA locais (não versionados — ver .gitignore)
├── config/
│   ├── capabilities/             # android.capabilities.ts / ios.capabilities.ts
│   └── test.config.ts            # Config centralizada (env vars + fallbacks)
├── docs/                         # Documentação técnica
│   ├── accessibility.md          # Guia de testes WCAG 2.2 AA
│   ├── account-logout-flow.md    # Fluxo de logout
│   ├── network-resilience.md     # Testes de resiliência de rede
│   └── qa-toolchain-review.md   # Avaliação cross-repo do ecossistema QA
├── scripts/
│   ├── lib/                      # Utilitários (timing, a11y dashboard, adb helpers)
│   ├── run-mobile-e2e-with-timing.ts
│   ├── generate-mobile-e2e-report.ts
│   ├── generate-a11y-report.ts
│   └── device-keep-awake.ts
├── tests/
│   ├── data/                     # Massa de dados dinâmica (Faker + pools mockados)
│   ├── enum/                     # Enums compartilhados (MaritalStatuses, VehicleUsages…)
│   ├── helpers/
│   │   ├── a11y/                 # Helpers de acessibilidade (matrix, audit, contrast)
│   │   ├── selectors.ts          # Seletores cross-platform + enum A11y (labels Flutter)
│   │   └── waits.ts              # waitForAppReady, sleep, wakeAndUnlockDevice…
│   ├── pages/                    # Screen Objects (Page Object Model)
│   │   ├── BaseScreen.ts         # Classe base com métodos comuns (tap, type, scroll…)
│   │   ├── HomeScreen.ts
│   │   ├── AccountScreen.ts
│   │   └── quotation/            # Telas do funil de cotação Auto
│   └── spec/
│       ├── smoke/                # appLaunch.spec.ts — gate de CI rápido
│       ├── e2e/                  # cotacaoAuto.spec.ts — fluxo completo (caminho feliz)
│       └── a11y/                 # Specs WCAG 2.2 AA por tela
├── .env.example                  # Template de variáveis de ambiente
├── wdio.conf.ts                  # Config WebdriverIO + Appium + hooks
└── package.json
```

---

## Pré-requisitos

| Requisito          | Detalhe                         |
| ------------------ | ------------------------------- |
| **Node.js v18+**   | [Download](https://nodejs.org/) |
| **Java JDK 11+**   | Necessário para Appium/Android  |
| **Android Studio** | SDK + emulador (para Android)   |
| **Xcode**          | Apenas macOS (para iOS)         |
| **Appium drivers** | Instalados via npm (ver abaixo) |

### Android — variáveis de ambiente

```bash
ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk
PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
```

Verifique dispositivo/emulador:

```bash
adb devices
```

---

## Instalação

```bash
cd C:\GIT\QA\qa-mobile-tests-automation
npm install

# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env

# Edite .env com package/bundle ID e caminho do APK
```

O `npm install` registra automaticamente o hook **Husky** (pre-commit com ESLint + Prettier nos arquivos staged).

Instale os drivers Appium:

```bash
npx appium driver install uiautomator2
npx appium driver install xcuitest   # apenas macOS
npm run appium:doctor
```

Coloque o APK em `apps/youse-qa.apk` (ou ajuste `ANDROID_APP_PATH` no `.env`).

---

## Como executar

```bash
# Smoke Android (padrão)
npm run test:smoke:android

# Smoke iOS (macOS)
npm run test:smoke:ios

# E2E completo (cotação Auto — caminho feliz, sem inspeção)
npm run test:e2e:android
npm run test:e2e:ios

# E2E Android com relatório de timing (dashboard Markdown)
npm run test:e2e:timing:android

# Suite completa (smoke + e2e + a11y)
npm run test:android
npm run test:ios

# Acessibilidade (WCAG 2.2 AA — ver docs/accessibility.md)
npm run test:a11y:smoke:android   # apenas Home (rápido, gate de PR)
npm run test:a11y:android         # Home + funil completo

# Gerar relatórios standalone (após execução)
npm run mobile:e2e:report         # dashboard E2E (docs/reports/)
npm run mobile:a11y:report        # dashboard A11y (docs/reports/)

# Manter dispositivo acordado durante sessão longa
npm run device:keep-awake

# Validar TypeScript + lint + format
npm run validate
```

---

## Configuração (.env)

Copie `.env.example` para `.env` e ajuste:

| Variável               | Descrição                         |
| ---------------------- | --------------------------------- |
| `PLATFORM`             | `android`, `ios` ou `both`        |
| `ANDROID_APP_PATH`     | Caminho do APK                    |
| `ANDROID_APP_PACKAGE`  | Package name (ex: `io.youse.app`) |
| `ANDROID_APP_ACTIVITY` | Activity principal                |
| `IOS_BUNDLE_ID`        | Bundle ID iOS                     |
| `TEST_*`               | Massa de dados de teste           |

---

## Padrões (alinhados ao E2E)

- **Screen Object Model** — uma classe por tela (`tests/pages/`)
- **Config centralizada** — `config/test.config.ts`
- **Massa dinâmica** — `@faker-js/faker` em `tests/data/`
- **Tags Mocha** — `@smoke`, `@e2e`, `@a11y`, `@mobile` nos describes
- **Screenshots on failure** — automático via `wdio.conf.ts`

---

## Git Hooks e Commits

### Fluxo de trabalho

```
git checkout -b feature/nome-da-feature
    │
    │  (desenvolve e faz git add)
    │
    ▼
git commit -m "feat(mobile): descrição"
    │
    ├─► pre-commit: lint-staged (ESLint + Prettier nos staged)
    │             typecheck dos .ts staged
    │             QA checks → exibe checklist ✅/❌/⚠️ no terminal
    │             (driver.pause, XPath, it.only, LGPD, debug, TODO)
    │
    ├─► commit-msg: valida Conventional Commits PT-BR
    │
    ▼
git push
    │
    ├─► pre-push: typecheck completo + lint + format:check
    │
    ▼
Pull Request → CI automático
    │
    ├─► validate: typecheck + lint + format + QA checks no diff do PR
    ├─► Copilot review: análise automática de código
    └─► Checklist bot: comentário com ✅/❌ por item do checklist
```

### Mensagens de commit (Conventional Commits PT-BR)

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| `feat` | Novo teste ou tela nova | `feat(mobile): adiciona spec de cotação Auto Android` |
| `fix` | Correção de bug em teste | `fix(funnel): corrige seletor da tela de planos` |
| `refactor` | Refatoração | `refactor: extrai navegação do funil para helpers/funnel.ts` |
| `test` | Novo spec a11y ou smoke | `test: adiciona smoke do app launch iOS` |
| `chore` | Dependências, config | `chore: atualiza WebdriverIO para v9` |
| `docs` | Documentação | `docs: atualiza guia de acessibilidade` |

**Regras validadas automaticamente:**
- Tipo obrigatório (`feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `ci`, `build`, `revert`)
- Título em minúsculas, máximo 72 caracteres
- Sem mistura de idiomas

### Checklist automático no terminal (pre-commit)

Ao fazer `git commit`, o hook exibe:

```
🔍 QA Pre-Commit Checks — Youse Seguradora (Mobile)
   2 arquivo(s) staged · 1 novo(s)

  ✓ Bloqueia arquivos .env                     · OK
  ✓ Detecta secrets / tokens                   · OK
  ✗ Sem driver.pause() / browser.pause()       · FAIL (1)
      └─ tests/spec/e2e/cotacaoAuto.spec.ts:38 → await driver.pause(3000)
  ✓ Sem it.only / describe.only                · OK
  ! XPath detectado (prefira accessibilityId)  · WARN (1)

📊 Resumo
   9 OK  ·  1 warn  ·  1 fail

❌ Commit bloqueado: corrija os itens FAIL.
```

### Comandos manuais

```bash
npm run qa:precommit    # roda QA checks nos staged (sem commitar)
npm run qa:check        # validate + qa:precommit (espelha o CI)
npm run validate        # typecheck + lint + format:check
```

**Emergência (pular hooks — sempre com justificativa no PR):**

```bash
git commit --no-verify -m "..."
git push --no-verify
```

### Pre-commit (Husky + lint-staged)

Hook: `.husky/pre-commit` — ao fazer `git commit`, executa automaticamente nos arquivos staged:

- **ESLint** com `--max-warnings=0` em todos os `.ts` modificados
- **Prettier** em todos os `.ts`, `.json`, `.yml` e `.md` modificados
- **Regras mobile** em `tests/**/*.ts` — bloqueia `driver.pause`, `browser.pause` e `Thread.sleep` (use `waitUntil` ou `tests/helpers/waits.ts`)

Testes Appium **não** rodam no pre-commit (exigem emulador/dispositivo e APK). A validação completa (`typecheck` + lint + format) roda no CI.

Após clonar o repositório, o hook é instalado automaticamente via `npm install` (script `prepare`).

---

## Próximos passos

1. ✅ Seletores mapeados em `tests/helpers/selectors.ts` (enum `A11y` + funções cross-platform)
2. Ajustar `ANDROID_APP_PACKAGE` / `ANDROID_APP_ACTIVITY` no `.env` (ver `.env.example`)
3. Executar o fluxo E2E: `npm run test:e2e:android`
4. Configurar secret `MOBILE_APK_BASE64` no GitHub para CI rodar no emulador

**Backlog técnico:**

- [ ] Criar testes de resiliência de rede (`tests/spec/network/`) — ver `docs/network-resilience.md`
- [ ] Integração Zephyr Scale para publicação automática de ciclos de teste
- [ ] Sharding (`--maxInstances 2`) por suite no CI para reduzir tempo de execução
- [ ] Performance profiling do app Flutter (`mobile: startPerfRecord`)

---

## Fluxo E2E — Cotação Auto

Espelha o caminho feliz do projeto web:

| Etapa        | Screen Object                    |
| ------------ | -------------------------------- |
| Home         | `HomeScreen`                     |
| Lead         | `LeadInfoScreen`                 |
| Veículo      | `VehicleDetailsScreen`           |
| Endereço/Uso | `VehicleAdditionalDetailsScreen` |
| CPF          | `PersonDataScreen`               |
| Bônus        | `BonusesClassScreen`             |
| Planos       | `PlanSelectionScreen`            |
| Checkout     | `CheckoutScreen`                 |
| Emissão      | `IssuanceScreen`                 |

```bash
npm run test:e2e:android    # fluxo completo Android (caminho feliz)
npm run test:smoke:android  # apenas app launch
```

### Placas de teste e fluxos de vistoria

> ⚠️ **Não usar YOU-0020 nem YOU-0023 no caminho feliz** — essas placas desviam o fluxo para telas de vistoria.

| Placa     | Comportamento                          | Spec                             |
| --------- | -------------------------------------- | -------------------------------- |
| `YOU-0001` | ✅ Sem inspeção — **usar no happy path** | `cotacaoAuto.spec.ts`            |
| `YOU-0020` | 🔍 Vistoria **online**                 | `vistoriaOnline.spec.ts`         |
| `YOU-0023` | 🎥 Vistoria por **vídeo** (Planetun-iVideo) | `vistoriaVideo.spec.ts`     |

Os specs de vistoria seguem o mesmo funil da cotação e validam que, após o checkout, o app exibe a tela de inspeção correspondente em vez de ir direto para "Seu pagamento foi aprovado".

> **TODO:** os labels exatos das telas de vistoria (`A11y.vistoriaOnlineTitle`, `A11y.vistoriaVideoTitle`, etc.) ainda precisam ser confirmados via Appium Inspector rodando cada spec com o device conectado. Após a execução, inspecionar o page source e atualizar `tests/helpers/selectors.ts` + remover os fallbacks de texto parcial em `InspectionScreen.ts`.

---

## CI (GitHub Actions)

Pipeline em `.github/workflows/ci.yml`:

| Job                  | Quando roda                                    |
| -------------------- | ---------------------------------------------- |
| `validate`           | Todo PR e push em `main`                       |
| `test-android-smoke` | Push em `main` ou manual (`workflow_dispatch`) |

Para CI executar testes, configure o secret **`MOBILE_APK_BASE64`** (APK codificado em base64).

---

## Troubleshooting

| Problema                                    | Solução                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `Could not find a connected Android device` | Rode `adb devices` e inicie um emulador                   |
| `App not installed`                         | Verifique `ANDROID_APP_PATH` e se o APK existe            |
| `Session not created`                       | Rode `npm run appium:doctor`                              |
| Elemento não encontrado                     | Atualize seletores em `tests/pages/` com Appium Inspector |
