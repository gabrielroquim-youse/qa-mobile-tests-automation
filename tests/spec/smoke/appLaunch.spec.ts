/**
 * Spec smoke — valida que o app abre e a tela inicial carrega.
 *
 * Pré-requisitos:
 * - Emulador/dispositivo conectado (adb devices / xcrun simctl list)
 * - APK/IPA em ./apps/ (ver .env.example)
 * - Appium drivers instalados (npm run appium:doctor)
 */
import HomeScreen from '../../pages/HomeScreen';
import { waitForAppReady } from '../../helpers/waits';

describe('Smoke — App Launch @smoke @mobile', () => {
  const homeScreen = new HomeScreen();

  before(async () => {
    await waitForAppReady();
  });

  it('deve abrir o app e exibir a tela inicial', async () => {
    const isLoaded = await homeScreen.isLoaded();
    expect(isLoaded).toBe(true);
  });

  it('deve exibir botão de cotação auto', async () => {
    const hasCotacaoButton = await homeScreen.hasCotacaoAutoButton();
    expect(hasCotacaoButton).toBe(true);
  });
});
