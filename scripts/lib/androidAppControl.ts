/**
 * Controle do app Android via adb (não depende de mobile:shell / adb_shell do Appium).
 */
import { execSync } from 'node:child_process';
import TestConfig from '../../config/test.config';

function adbPrefix(serial?: string): string {
  return serial ? `adb -s ${serial} ` : 'adb ';
}

const ADB_TIMEOUT_MS = 60_000;

export function adbShell(command: string, serial?: string): void {
  execSync(`${adbPrefix(serial)}shell ${command}`, { stdio: 'ignore', timeout: ADB_TIMEOUT_MS });
}

export function forceStopApp(appPackage: string, serial?: string): void {
  try {
    adbShell(`am force-stop ${appPackage}`, serial);
  } catch {
    // ignore
  }
}

export function launchApp(appPackage: string, activity: string, serial?: string): void {
  const component = activity.startsWith('.') ? `${appPackage}/${activity}` : `${appPackage}/${activity}`;
  try {
    adbShell(`am start -n ${component}`, serial);
  } catch {
    // ignore
  }
}

/** Force-stop + cold start — estado limpo com noReset (processo morto, UI reinicia) */
export function coldStartApp(
  appPackage = TestConfig.android.appPackage,
  activity = TestConfig.android.appActivity,
  serial = TestConfig.android.udid || undefined,
): void {
  forceStopApp(appPackage, serial);
  launchApp(appPackage, activity, serial);
}
