import type { Capabilities } from '@wdio/types';
import TestConfig from '../test.config';

export const iosCapabilities: Capabilities.RequestedStandaloneCapabilities = {
  platformName: 'iOS',
  'appium:automationName': 'XCUITest',
  'appium:deviceName': TestConfig.ios.deviceName,
  'appium:platformVersion': TestConfig.ios.platformVersion,
  'appium:app': TestConfig.ios.appPath,
  'appium:bundleId': TestConfig.ios.bundleId,
  ...(TestConfig.ios.udid ? { 'appium:udid': TestConfig.ios.udid } : {}),
  'appium:autoAcceptAlerts': true,
  'appium:noReset': false,
  'appium:fullReset': false,
  'appium:newCommandTimeout': 120,
};

export default iosCapabilities;
