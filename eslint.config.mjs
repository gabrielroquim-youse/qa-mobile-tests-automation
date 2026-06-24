// @ts-check
import { fileURLToPath } from 'url';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettierConfig from 'eslint-config-prettier';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** Regras de automação mobile (Appium/WebdriverIO) — aplicadas em specs e Screen Objects */
const mobileAutomationRules = {
  'no-restricted-syntax': [
    'error',
    {
      selector: "CallExpression[callee.object.name='driver'][callee.property.name='pause']",
      message: 'Evite driver.pause — use waitUntil ou helpers em tests/helpers/waits.ts.',
    },
    {
      selector: "CallExpression[callee.object.name='browser'][callee.property.name='pause']",
      message: 'Evite browser.pause — use waitUntil ou helpers em tests/helpers/waits.ts.',
    },
  ],
  'no-restricted-properties': [
    'error',
    {
      object: 'Thread',
      property: 'sleep',
      message: 'Thread.sleep não se aplica em testes WDIO — use waitUntil ou helpers de wait.',
    },
  ],
};

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'allure-results/**', 'allure-report/**', 'logs/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['tests/**/*.ts'],
    rules: mobileAutomationRules,
  },
  prettierConfig,
];
