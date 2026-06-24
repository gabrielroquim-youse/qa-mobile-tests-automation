/**
 * Helpers de espera e interação mobile.
 */
import TestConfig from '../../config/test.config';
import { coldStartApp, forceStopApp } from '../../scripts/lib/androidAppControl';

/** Sleep não-bloqueante — substitui `driver.pause` (banido pela regra ESLint do projeto). */
export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getAppId(): string {
  return TestConfig.platform === 'ios' ? TestConfig.ios.bundleId : TestConfig.android.appPackage;
}

/** Acorda a tela (Samsung AOD / tela apagada) */
async function wakeScreen(): Promise<void> {
  if (!driver.isAndroid) return;

  try {
    await driver.pressKeyCode(224); // KEYCODE_WAKEUP
    await sleep(400);
  } catch {
    // ignore
  }
}

/** Fecha shade de notificações / AOD quando systemui está em foreground */
async function dismissSystemOverlays(appPackage: string): Promise<void> {
  if (!driver.isAndroid) return;

  try {
    const currentPackage = await driver.getCurrentPackage();
    if (currentPackage === appPackage) return;

    // Swipe para cima — fecha notification shade / lock screen (Samsung One UI)
    const { width, height } = await driver.getWindowSize();
    const centerX = Math.floor(width / 2);
    const startY = Math.floor(height * 0.85);
    const endY = Math.floor(height * 0.15);
    await driver.performActions([
      {
        type: 'pointer',
        id: 'finger1',
        parameters: { pointerType: 'touch' },
        actions: [
          { type: 'pointerMove', duration: 0, x: centerX, y: startY },
          { type: 'pointerDown', button: 0 },
          { type: 'pause', duration: 200 },
          { type: 'pointerMove', duration: 400, x: centerX, y: endY },
          { type: 'pointerUp', button: 0 },
        ],
      },
    ]);
    await driver.releaseActions();
    await sleep(500);
  } catch {
    // ignore
  }
}

/** Desbloqueia o device e garante que overlays do sistema não cobrem o app */
async function ensureDeviceUnlocked(appPackage: string): Promise<void> {
  if (!driver.isAndroid) return;

  await wakeScreen();

  try {
    if (await driver.isLocked()) {
      await driver.unlock();
      await sleep(500);
    }
  } catch {
    // unlock pode exigir PIN/pattern — usuário deve desbloquear manualmente
  }

  await dismissSystemOverlays(appPackage);
}

/** Acorda e desbloqueia — use no início de specs ou em hooks WDIO */
export async function wakeAndUnlockDevice(): Promise<void> {
  await ensureDeviceUnlocked(getAppId());
}

let wakeInterval: ReturnType<typeof setInterval> | null = null;

/** Pulso a cada 90s em E2E longos — complementa keepScreenOn do Appium */
export function startPeriodicWake(intervalMs = 90_000): void {
  if (wakeInterval || TestConfig.platform !== 'android') return;

  wakeInterval = setInterval(() => {
    wakeAndUnlockDevice().catch(() => undefined);
  }, intervalMs);
}

export function stopPeriodicWake(): void {
  if (wakeInterval) {
    clearInterval(wakeInterval);
    wakeInterval = null;
  }
}

export async function waitForAppReady(timeout = 30_000): Promise<void> {
  const appId = getAppId();

  await ensureDeviceUnlocked(appId);

  try {
    await driver.activateApp(appId);
  } catch {
    // activateApp pode falhar se sessão ainda está iniciando
  }

  await driver.waitUntil(
    async () => {
      await ensureDeviceUnlocked(appId);

      const state = await driver.queryAppState(appId);
      let onAppUi = false;
      if (driver.isAndroid) {
        try {
          onAppUi = (await driver.getCurrentPackage()) === appId;
        } catch {
          onAppUi = false;
        }
      } else {
        onAppUi = state === 4;
      }

      // 4 = foreground — exige também package correto no Android (evita AOD/shade)
      if (state === 4 && onAppUi) return true;

      if (state === 3 || state === 2 || !onAppUi) {
        await driver.activateApp(appId);
        await sleep(800);
      }
      return false;
    },
    { timeout, timeoutMsg: 'App não ficou em foreground dentro do timeout' },
  );
}

export async function resetAppForE2e(): Promise<void> {
  const appId = getAppId();

  await wakeAndUnlockDevice();

  if (driver.isAndroid) {
    const serial = TestConfig.android.udid || undefined;
    forceStopApp(appId, serial);
    await sleep(1_500);
    coldStartApp(appId, TestConfig.android.appActivity, serial);
    await sleep(2_000);
  } else {
    try {
      await driver.terminateApp(appId);
      await sleep(1_000);
    } catch {
      // ignore
    }
    await driver.activateApp(appId);
  }

  await waitForAppReady(45_000);
}

export async function hideKeyboard(): Promise<void> {
  try {
    const isShown = await driver.isKeyboardShown();
    if (isShown) {
      await driver.hideKeyboard();
    }
  } catch {
    // Teclado pode não estar visível em algumas plataformas
  }
}

export function getPlatform(): 'android' | 'ios' {
  const caps = driver.capabilities as WebdriverIO.Capabilities;
  const platform = caps.platformName?.toLowerCase();
  return platform === 'ios' ? 'ios' : 'android';
}
