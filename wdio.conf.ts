import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import allure from '@wdio/allure-reporter';
import { androidCapabilities } from './config/capabilities/android.capabilities';
import { iosCapabilities } from './config/capabilities/ios.capabilities';
import TestConfig from './config/test.config';
import { enableKeepAwake, restoreKeepAwake, type KeepAwakeSnapshot } from './scripts/lib/androidKeepAwake';
import { coldStartApp } from './scripts/lib/androidAppControl';

const platform = TestConfig.platform;
const specs = process.env.SPECS ? [process.env.SPECS] : ['./tests/spec/**/*.spec.ts'];
const useExternalAppium = process.env.APPIUM_EXTERNAL === 'true';

/** Snapshot adb — restaurado em onComplete */
let keepAwakeSnapshot: KeepAwakeSnapshot | null = null;

function buildCapabilities() {
  if (platform === 'android') return [androidCapabilities];
  if (platform === 'ios') return [iosCapabilities];
  return [androidCapabilities, iosCapabilities];
}

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs,
  maxInstances: 1,
  capabilities: buildCapabilities(),
  hostname: TestConfig.appium.host,
  port: TestConfig.appium.port,
  path: '/',
  logLevel: 'info',
  bail: 0,
  waitforTimeout: TestConfig.timeouts.default,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,
  services: useExternalAppium
    ? []
    : [
        [
          'appium',
          {
            args: {
              address: TestConfig.appium.host,
              port: TestConfig.appium.port,
              allowInsecure: ['adb_shell'],
              'use-drivers': 'uiautomator2',
            },
            command: join(
              process.cwd(),
              'node_modules',
              '.bin',
              process.platform === 'win32' ? 'appium.cmd' : 'appium',
            ),
            appiumStartTimeout: 300_000,
          },
        ],
      ],
  framework: 'mocha',
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],
  mochaOpts: {
    ui: 'bdd',
    timeout: TestConfig.timeouts.default,
  },

  onPrepare: () => {
    if (platform !== 'android') return;

    const serial = TestConfig.android.udid || undefined;
    try {
      if (TestConfig.android.keepAwake) {
        keepAwakeSnapshot = enableKeepAwake(serial);
      }
      coldStartApp(TestConfig.android.appPackage, TestConfig.android.appActivity, serial);
    } catch (err) {
      console.warn('[onPrepare] adb prep falhou — Appium seguirá mesmo assim:', err);
    }
  },

  onComplete: () => {
    if (platform !== 'android' || !TestConfig.android.keepAwake) return;

    restoreKeepAwake(TestConfig.android.udid || undefined, keepAwakeSnapshot);
    keepAwakeSnapshot = null;
  },

  before: async () => {
    mkdirSync('screenshots', { recursive: true });
    await driver.setTimeout({ implicit: TestConfig.timeouts.implicit });

    if (driver.isAndroid) {
      const { wakeAndUnlockDevice, startPeriodicWake } = await import('./tests/helpers/waits');
      await wakeAndUnlockDevice();
      startPeriodicWake();
    }
  },

  after: async () => {
    if (driver.isAndroid) {
      const { stopPeriodicWake } = await import('./tests/helpers/waits');
      stopPeriodicWake();
    }
  },

  afterTest: async (test, _context, { passed }) => {
    if (!passed) {
      if (driver.isAndroid) {
        try {
          const { wakeAndUnlockDevice } = await import('./tests/helpers/waits');
          await wakeAndUnlockDevice();
        } catch {
          // sessão pode já ter encerrado
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const testName = test.title.replace(/\s+/g, '-').slice(0, 80);
      const screenshotPath = join('screenshots', `failure-${testName}-${timestamp}.png`);

      const screenshotBase64 = await driver.takeScreenshot();
      mkdirSync('screenshots', { recursive: true });
      writeFileSync(screenshotPath, screenshotBase64, 'base64');
      allure.addAttachment('Screenshot', Buffer.from(screenshotBase64, 'base64'), 'image/png');

      try {
        const pageSource = await driver.getPageSource();
        allure.addAttachment('Page Source', pageSource, 'text/xml');
      } catch {
        // Page source pode falhar se a sessão já encerrou
      }
    }
  },
};

export default config;
