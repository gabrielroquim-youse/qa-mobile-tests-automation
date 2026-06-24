/**
 * Etapa 3 — Detalhes adicionais do veículo (mobile).
 */
import { VehicleUsages } from '../../enum/VehicleUsages';
import { hideKeyboard, sleep } from '../../helpers/waits';
import { A11y, byDescContains, byHint } from '../../helpers/selectors';
import QuotationScreenLayout from './QuotationScreenLayout';

export class VehicleAdditionalDetailsScreen extends QuotationScreenLayout {
  async waitForLoaded(): Promise<void> {
    const loaded = await driver.waitUntil(
      async () =>
        (await this.hasText(A11y.addressTitle, 1_000)) ||
        (await this.isVisible(byHint(A11y.inputCep), 1_000)) ||
        (await this.hasText(A11y.usageTitle, 1_000)),
      { timeout: 60_000, timeoutMsg: 'Tela de endereço/uso não carregou' },
    );
    if (!loaded) throw new Error('Tela de endereço/uso não carregou');
  }

  async fillAddress(zipCode = '04777020', addressNumber = '99999'): Promise<VehicleAdditionalDetailsScreen> {
    await this.typeByLabel(A11y.inputCep, zipCode.replace(/\D/g, ''));
    await hideKeyboard();

    const onConfirm = await driver
      .waitUntil(
        async () =>
          (await this.hasText(A11y.addressConfirmTitle, 1_000)) ||
          (await this.isVisible(byHint(A11y.inputNumero), 1_000)),
        { timeout: 15_000, interval: 500 },
      )
      .catch(() => false);

    if (onConfirm) {
      await this.typeByLabel(A11y.inputNumero, addressNumber);
      await this.tapByLabel(A11y.btnSalvar);
      await sleep(1_000);
      return this;
    }

    for (const hint of [A11y.inputNumero, A11y.inputNumeroAlt]) {
      if (await this.isVisible(byHint(hint), 3_000)) {
        await this.typeByLabel(hint, addressNumber);
        return this;
      }
    }

    return this;
  }

  async isOvernightGarage(overnightGarage = true): Promise<VehicleAdditionalDetailsScreen> {
    await this.tapByLabel(overnightGarage ? A11y.btnSim : A11y.btnNao);
    return this;
  }

  async selectUsage(usage: VehicleUsages = VehicleUsages.PRIVATE): Promise<VehicleAdditionalDetailsScreen> {
    await this.scrollToElement(byDescContains(A11y.btnContinuar));
    await this.tapByLabel(usage);
    return this;
  }
}

export default VehicleAdditionalDetailsScreen;
