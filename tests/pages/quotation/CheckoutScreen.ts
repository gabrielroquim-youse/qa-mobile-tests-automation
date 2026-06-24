/**
 * Etapa 7 — Checkout e pagamento (mobile).
 */
import TestConfig from '../../../config/test.config';
import { A11y } from '../../helpers/selectors';
import BaseScreen from '../BaseScreen';

export class CheckoutScreen extends BaseScreen {
  async waitForLoaded(): Promise<void> {
    await driver.waitUntil(
      async () =>
        (await this.hasTextQuick(A11y.checkoutTitle)) ||
        (await this.hasTextQuick(A11y.checkoutTotal)) ||
        (await this.hasTextQuick(A11y.paymentEmailTitle)) ||
        (await this.hasTextQuick(A11y.checkoutGoPayment)),
      {
        timeout: 90_000,
        interval: 1_500,
        timeoutMsg: 'Tela de checkout não carregou',
      },
    );
  }

  async goToPaymentIfNeeded(): Promise<CheckoutScreen> {
    if (await this.hasText(A11y.checkoutGoPayment, 5_000)) {
      await this.scrollToText(A11y.checkoutGoPayment, 10_000);
      await this.tapByLabel(A11y.checkoutGoPayment);
    }
    return this;
  }

  async checkEmailConfirmation(): Promise<CheckoutScreen> {
    await this.goToPaymentIfNeeded();

    if (await this.hasText(A11y.paymentEmailTitle, 15_000)) {
      const email = TestConfig.credentials.email;
      if (email) {
        await this.typeByLabel('Repita seu e-mail', email);
      }
      await this.tapContinuar();
      return this;
    }

    if (await this.hasText(A11y.footerCompliance, 3_000)) {
      await this.scrollToText(A11y.footerCompliance);
      await this.tapByLabel(A11y.footerCompliance);
    }
    return this;
  }

  async openAssistenciasAccordion(): Promise<CheckoutScreen> {
    await this.scrollToText(A11y.checkoutAssistencias, 10_000);
    await this.tapByLabel(A11y.checkoutAssistencias);
    return this;
  }

  async upsellVisible(productName: string): Promise<boolean> {
    try {
      await this.scrollToText(productName, 8_000);
    } catch {
      // upsell pode estar acima da dobra
    }
    return this.hasText(productName, 5_000);
  }

  async fillCreditCardData(
    cardNumber: string,
    expireDate: string,
    cvv: string,
    holderName: string,
  ): Promise<CheckoutScreen> {
    if (await this.hasText(A11y.paymentCreditCard, 8_000)) {
      await this.tapByLabel(A11y.paymentCreditCard);
    }

    await this.typeByLabel(A11y.inputCardNumber, cardNumber.replace(/\s/g, ''));
    await this.typeByLabel(A11y.inputCardHolder, holderName);
    await this.typeByLabel(A11y.inputCardExpire, expireDate);
    await this.typeByLabel(A11y.inputCardCvv, cvv);
    return this;
  }

  async clickFinishBtn(): Promise<void> {
    await this.goToPaymentIfNeeded();
    await this.scrollToText(A11y.paymentPayNow, 15_000);
    await this.tapByLabel(A11y.paymentPayNow);
  }
}

export default CheckoutScreen;
