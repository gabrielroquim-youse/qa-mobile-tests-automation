/**
 * Etapa 4 — Dados pessoais do segurado (mobile).
 */
import { MaritalStatuses } from '../../enum/MaritalStatuses';
import { A11y, byHint } from '../../helpers/selectors';
import QuotationScreenLayout from './QuotationScreenLayout';

export class PersonDataScreen extends QuotationScreenLayout {
  async waitForLoaded(): Promise<void> {
    const loaded =
      (await this.hasText(A11y.personTitle, 15_000)) ||
      (await this.hasText(A11y.inputCpf, 15_000)) ||
      (await this.hasText(A11y.personMaritalTitle, 15_000));
    if (!loaded) throw new Error('Tela de dados pessoais não carregou');
  }

  async fillDocumentNumber(documentNumber = '12345676108'): Promise<PersonDataScreen> {
    if (await this.isVisible(byHint(A11y.inputCpf), 5_000)) {
      await this.typeByLabel(A11y.inputCpf, documentNumber.replace(/\D/g, ''));
    }
    return this;
  }

  async selectMaritalStatus(maritalStatus: MaritalStatuses): Promise<PersonDataScreen> {
    await this.tapByLabel(maritalStatus);
    return this;
  }

  async hasRestrictedCpfMessage(): Promise<boolean> {
    return (
      (await this.hasText('recusado')) ||
      (await this.hasText('restrição')) ||
      (await this.hasText('não autorizado')) ||
      (await this.hasText('não foi aceito'))
    );
  }
}

export default PersonDataScreen;
