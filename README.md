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

```
qa-mobile-tests-automation/
├── apps/                    # APK/IPA locais (não versionados)
├── config/
│   ├── capabilities/        # Android e iOS capabilities
│   └── test.config.ts       # Config centralizada
├── tests/
│   ├── data/                # Massa de dados
│   ├── helpers/             # Waits, keyboard, platform utils
│   ├── pages/               # Screen Objects (Page Object Model)
│   └── spec/
│       └── smoke/           # Testes smoke
├── wdio.conf.ts             # Config WebdriverIO + Appium
├── .env.example
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

# Suite completa
npm run test:android
npm run test:ios

# Acessibilidade (WCAG 2.2 AA — ver docs/accessibility.md)
npm run test:a11y:smoke:android   # apenas Home (rápido, CI)
npm run test:a11y:android         # Home + funil

# Validar TypeScript + lint
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
- **Tags Mocha** — `@smoke`, `@regression` nos describes
- **Screenshots on failure** — automático via `wdio.conf.ts`

### Pre-commit (Husky + lint-staged)

Espelha o projeto [qa-e2e-tests-automation](../qa-e2e-tests-automation). Ao fazer `git commit`, o hook executa automaticamente nos arquivos staged:

- **ESLint** com `--max-warnings=0` em todos os `.ts` modificados
- **Prettier** em todos os `.ts`, `.json`, `.yml` e `.md` modificados
- **Regras mobile** em `tests/**/*.ts` — bloqueia `driver.pause`, `browser.pause` e `Thread.sleep` (use `waitUntil` ou `tests/helpers/waits.ts`)

Testes Appium **não** rodam no pre-commit (exigem emulador/dispositivo e APK). A validação completa (`typecheck` + lint + format) roda no CI.

Após clonar o repositório, o hook é instalado automaticamente via `npm install` (script `prepare`).

---

## Próximos passos

1. Mapear seletores reais do app com **Appium Inspector** (`tests/helpers/selectors.ts`)
2. Ajustar `ANDROID_APP_PACKAGE` / `ANDROID_APP_ACTIVITY` no `.env`
3. Executar o fluxo E2E: `npm run test:e2e:android`
4. Configurar secret `MOBILE_APK_BASE64` no GitHub para CI rodar smoke no emulador

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
npm run test:e2e:android    # fluxo completo Android
npm run test:smoke:android  # apenas app launch
```

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
