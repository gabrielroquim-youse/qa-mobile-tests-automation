/**
 * Tela inicial / Home do app Youse (Flutter).
 * Seletores mapeados via page source e mob-flutter i18n — content-desc, não resource-id.
 */
import { A11y, byDescContains } from '../helpers/selectors';
import { sleep } from '../helpers/waits';
import BaseScreen from './BaseScreen';

export class HomeScreen extends BaseScreen {
  /** Verifica se a tela inicial carregou (re-tenta trazer o app se systemui cobrir a tela) */
  async isLoaded(): Promise<boolean> {
    if (await this.isVisible(byDescContains(A11y.welcomeTitle), 8_000)) {
      return true;
    }

    const { waitForAppReady } = await import('../helpers/waits');
    await waitForAppReady(20_000);
    return this.isVisible(byDescContains(A11y.welcomeTitle), 15_000);
  }

  private async isMidFunnel(): Promise<boolean> {
    return (
      (await this.isVisible(byDescContains(A11y.vehicleTitle), 2_000)) ||
      (await this.isVisible(byDescContains(A11y.addressTitle), 2_000)) ||
      (await this.isVisible(byDescContains(A11y.personTitle), 2_000)) ||
      (await this.isVisible(byDescContains(A11y.bonusToggleTitle), 2_000)) ||
      (await this.isVisible(byDescContains(A11y.planTitle), 2_000)) ||
      (await this.isVisible(byDescContains(A11y.checkoutTitle), 2_000))
    );
  }

  /** Volta para Home/Lead quando o app retoma no meio do funil após noReset */
  private async recoverToQuotationStart(): Promise<void> {
    const { resetAppForE2e } = await import('../helpers/waits');
    await resetAppForE2e();

    if (!(await this.isMidFunnel()) || (await this.isVisible(byDescContains(A11y.leadTitle), 3_000))) {
      return;
    }

    await this.dismissCacheDialogIfPresent();

    for (let i = 0; i < 8; i++) {
      if (
        (await this.isVisible(byDescContains(A11y.leadTitle), 2_000)) ||
        (await this.isVisible(byDescContains(A11y.welcomeTitle), 2_000))
      ) {
        return;
      }
      try {
        await driver.back();
        await sleep(700);
      } catch {
        break;
      }
    }

    if (await this.isMidFunnel()) {
      await resetAppForE2e();
      await this.dismissCacheDialogIfPresent();
    }
  }

  /**
   * Garante início do fluxo de cotação auto a partir da Home ou Lead (cache).
   * Se o app retomou no meio do funil (ex.: Veículo), reinicia a sessão.
   */
  async ensureCotacaoAutoFlow(): Promise<'home' | 'lead'> {
    if ((await this.isMidFunnel()) && !(await this.isVisible(byDescContains(A11y.leadTitle), 2_000))) {
      await this.recoverToQuotationStart();
    }

    if (await this.isVisible(byDescContains(A11y.leadTitle), 8_000)) {
      return 'lead';
    }

    await this.dismissCacheDialogIfPresent();

    if (await this.isVisible(byDescContains(A11y.leadTitle), 8_000)) {
      return 'lead';
    }

    if (await this.isLoaded()) {
      await this.openCotacaoAuto();
      if (await this.isVisible(byDescContains(A11y.leadTitle), 10_000)) {
        return 'lead';
      }
      return 'home';
    }

    if (await this.isVisible(byDescContains(A11y.leadTitle), 8_000)) {
      return 'lead';
    }

    throw new Error('Não foi possível iniciar cotação auto — Home nem Lead detectados');
  }

  /** Verifica se o card de cotação auto está visível */
  async hasCotacaoAutoButton(): Promise<boolean> {
    return this.isVisible(byDescContains(A11y.seguroAutoCard), 5_000);
  }

  /** Descarta diálogo de cotação em cache, se exibido */
  async dismissCacheDialogIfPresent(): Promise<void> {
    if (await this.hasText(A11y.cacheTitle, 4_000)) {
      await this.tapByLabel(A11y.cacheStartNew);
    }
  }

  /** Navega para fluxo de cotação auto */
  async openCotacaoAuto(): Promise<void> {
    await this.tap(byDescContains(A11y.seguroAutoCard), 10_000);
    await this.dismissCacheDialogIfPresent();
  }
}

export default HomeScreen;
