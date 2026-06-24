/**
 * Etapa 8 — Confirmação da contratação (mobile).
 */
import { A11y } from '../../helpers/selectors';
import BaseScreen from '../BaseScreen';

export class IssuanceScreen extends BaseScreen {
  async waitForResult(): Promise<void> {
    await driver.waitUntil(
      async () =>
        (await this.isOnSuccessPage()) ||
        (await this.isOnErrorPage()) ||
        (await this.hasText('processando o seu pagamento')),
      { timeout: 120_000, interval: 2_000, timeoutMsg: 'Resultado da contratação não apareceu' },
    );
  }

  async isOnSuccessPage(): Promise<boolean> {
    return (
      (await this.hasText(A11y.issuanceSuccessTitle)) ||
      (await this.hasText(A11y.issuanceProposalTitle)) ||
      (await this.hasText('Parabéns'))
    );
  }

  async isOnErrorPage(): Promise<boolean> {
    return (
      (await this.hasText(A11y.issuanceErrorTitle)) ||
      (await this.hasText('Ops!')) ||
      (await this.hasText('Pagamento não confirmado'))
    );
  }

  async successTagsVisible(): Promise<boolean> {
    return (await this.hasText(A11y.issuanceSuccessTitle)) || (await this.hasText(A11y.issuanceProposalTitle));
  }
}

export default IssuanceScreen;
