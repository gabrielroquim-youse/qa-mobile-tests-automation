/**
 * Mantém a tela do Android ligada durante testes (via adb).
 * Restaura configurações originais ao finalizar.
 */
import { execSync } from 'node:child_process';

export interface KeepAwakeSnapshot {
  screenOffTimeout: string;
  stayOnWhilePluggedIn: string;
}

const ADB_TIMEOUT_MS = 60_000;

function adbShell(serial: string | undefined, command: string): string {
  const prefix = serial ? `adb -s ${serial} ` : 'adb ';
  return execSync(`${prefix}shell ${command}`, { encoding: 'utf8', timeout: ADB_TIMEOUT_MS }).trim();
}

function adbShellSafe(serial: string | undefined, command: string): void {
  try {
    adbShell(serial, command);
  } catch {
    // Alguns OEMs bloqueiam certos settings — ignorar
  }
}

/** Liga tela e tenta dismiss lock screen (swipe) antes da sessão Appium */
export function wakeDevice(serial: string | undefined): void {
  adbShellSafe(serial, 'input keyevent KEYCODE_WAKEUP');
  adbShellSafe(serial, 'input swipe 540 1800 540 400 300');
}

/**
 * Impede bloqueio automático enquanto o cabo USB está conectado.
 * Retorna snapshot para restaurar depois.
 */
export function enableKeepAwake(serial: string | undefined): KeepAwakeSnapshot {
  wakeDevice(serial);

  const snapshot: KeepAwakeSnapshot = {
    screenOffTimeout: adbShell(serial, 'settings get system screen_off_timeout') || '30000',
    stayOnWhilePluggedIn: adbShell(serial, 'settings get global stay_on_while_plugged_in') || '0',
  };

  // Timeout máximo (~24 dias) + manter ligado com USB/AC/carregador sem fio
  adbShellSafe(serial, 'settings put system screen_off_timeout 2147483647');
  adbShellSafe(serial, 'settings put global stay_on_while_plugged_in 7');
  // Complemento: força stay-on enquanto adb/usb ativo (funciona na maioria dos devices)
  adbShellSafe(serial, 'svc power stayon true');

  return snapshot;
}

export function restoreKeepAwake(serial: string | undefined, snapshot: KeepAwakeSnapshot | null): void {
  if (!snapshot) return;

  adbShellSafe(serial, 'svc power stayon false');
  adbShellSafe(serial, `settings put system screen_off_timeout ${snapshot.screenOffTimeout}`);
  adbShellSafe(serial, `settings put global stay_on_while_plugged_in ${snapshot.stayOnWhilePluggedIn}`);
}
