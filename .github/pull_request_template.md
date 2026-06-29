## Descrição

> Descreva em 1–3 frases o que esta PR faz e qual problema ela resolve.

---

## Tipo de mudança

- [ ] `feat` — nova funcionalidade ou novo teste
- [ ] `fix` — correção de bug em teste ou Screen Object
- [ ] `refactor` — refatoração sem mudança de comportamento
- [ ] `chore` — ajuste de configuração, dependências ou CI
- [ ] `docs` — documentação
- [ ] `test` — novo teste automatizado

---

## Checklist de Qualidade

### Código Mobile

- [ ] Sem `driver.pause()` ou `browser.pause()` (esperas fixas) — use `waitUntil` ou helpers de wait
- [ ] Sem `it.only` ou `describe.only`
- [ ] Seletores usam `$('~accessibilityId')` ou `byDescContains()` — evitar XPath (`$('//...`)
- [ ] Sem dados sensíveis (CPF real, e-mail pessoal, token) inseridos no código
- [ ] Nenhum `debugger;` esquecido
- [ ] TODO/FIXME referenciam ticket Jira (ex: `TODO POSV-123`)

### Testes

- [ ] Tags corretas adicionadas (`@smoke`, `@e2e`, `@a11y`, `@mobile`)
- [ ] Spec no diretório correto: `smoke/` · `e2e/` · `a11y/`
- [ ] Testado em Android (emulador ou dispositivo real)
- [ ] Novos cenários cobrem apenas comportamento nativo — fluxos web ficam em `qa-e2e-tests-automation`

### Screen Objects / Helpers

- [ ] Novos métodos adicionados ao Screen Object correspondente (não na spec)
- [ ] Novos seletores adicionados em `tests/helpers/selectors.ts` (objeto `A11y`)
- [ ] Helpers reutilizáveis extraídos para `tests/helpers/`
- [ ] Nenhuma lógica de navegação duplicada (usar `runFunnelToCheckout()` quando aplicável)

### Acessibilidade (se `@a11y`)

- [ ] Novos elementos nativos Flutter possuem `content-desc` definido
- [ ] Matrix de acessibilidade (`LEAD_MATRIX`, `CHECKOUT_MATRIX`, etc.) atualizada se nova tela foi adicionada

---

## Como testar localmente

```bash
# E2E no Android
npm run test:e2e:android

# A11y no Android
npm run test:a11y:android

# Smoke
npm run test:smoke:android
```

---

## Links relacionados

- Jira/Issue: <!-- ex: POSV-123 -->
- PR relacionada: <!-- ex: #42 -->
