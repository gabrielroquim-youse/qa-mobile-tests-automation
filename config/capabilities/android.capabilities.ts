import type { Capabilities } from '@wdio/types';
import TestConfig from '../test.config';

const unlockCaps =
  TestConfig.android.unlockType && TestConfig.android.unlockKey
    ? {
        'appium:unlockType': TestConfig.android.unlockType,
        'appium:unlockKey': TestConfig.android.unlockKey,
      }
    : {};

const baseCapabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': TestConfig.android.deviceName,
  'appium:platformVersion': TestConfig.android.platformVersion,
  ...(TestConfig.android.udid ? { 'appium:udid': TestConfig.android.udid } : {}),
  'appium:appPackage': TestConfig.android.appPackage,
  'appium:appActivity': TestConfig.android.appActivity,
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 120,
  ...unlockCaps,
  /** Aparelhos mais lentos (ex.: LG K41S/K415S, 3 GB RAM) */
  'appium:adbExecTimeout': 60_000,
  'appium:uiautomator2ServerInstallTimeout': 60_000,
  'appium:androidInstallTimeout': 120_000,
} as Capabilities.RequestedStandaloneCapabilities;

/** UiAutomator2 — mantém tela ligada durante a sessão */
const keepScreenOn = { 'appium:settings[keepScreenOn]': true };

export const androidCapabilities: Capabilities.RequestedStandaloneCapabilities = TestConfig.android.useInstalledApp
  ? {
      ...baseCapabilities,
      ...keepScreenOn,
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:appWaitActivity': '*',
      'appium:appWaitPackage': TestConfig.android.appPackage,
      'appium:skipUnlock': false,
    }
  : {
      ...baseCapabilities,
      ...keepScreenOn,
      'appium:app': TestConfig.android.appPath,
      'appium:noReset': false,
      'appium:fullReset': false,
    };

export default androidCapabilities;
