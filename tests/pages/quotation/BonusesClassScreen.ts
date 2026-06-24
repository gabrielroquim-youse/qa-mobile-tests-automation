/**
 * Etapa 5 — Histórico de seguro e Classe de Bônus (mobile).
 */
import { UserBonusClass } from '../../enum/UserBonusClass';
import { A11y } from '../../helpers/selectors';
import QuotationScreenLayout from './QuotationScreenLayout';

export class BonusesClassScreen extends QuotationScreenLayout {
  async waitForLoaded(): Promise<void> {
    const loaded = await this.hasText(A11y.bonusToggleTitle, 30_000);
    if (!loaded) throw new Error('Tela de bônus não carregou');
  }

  async useBonusClass(
    useBonusClass = false,
    userBonusClass: UserBonusClass = UserBonusClass.ONE,
  ): Promise<BonusesClassScreen> {
    if (useBonusClass) {
      await this.tapByLabel(A11y.btnSim);
      await this.tapByLabel(A11y.bonusClassTitle);
      await this.tapByLabel(userBonusClass);
    } else {
      await this.tapByLabel(A11y.btnNao);
    }
    return this;
  }

  async isWhatsappVisible(): Promise<boolean> {
    return this.hasText('whatsapp');
  }
}

export default BonusesClassScreen;
