/**
 * Etapa 1 — Dados de contato do lead (mobile).
 */
import TestConfig from '../../../config/test.config';
import { A11y } from '../../helpers/selectors';
import QuotationScreenLayout from './QuotationScreenLayout';

export interface LeadData {
  name?: string;
  email?: string;
  phone?: string;
}

export class LeadInfoScreen extends QuotationScreenLayout {
  async isLoaded(): Promise<boolean> {
    return this.hasText(A11y.leadTitle, 5_000);
  }

  async waitForLoaded(): Promise<void> {
    const loaded = await this.hasText(A11y.leadTitle, 30_000);
    if (!loaded) throw new Error('Tela de lead não carregou');
  }

  async fillLeadData(data?: LeadData): Promise<LeadInfoScreen> {
    const name = data?.name ?? TestConfig.credentials.name;
    const email = data?.email ?? TestConfig.credentials.email;
    const phone = data?.phone ?? TestConfig.credentials.phone;

    await this.typeByLabel(A11y.inputNome, name);
    await this.typeByLabel(A11y.inputEmail, email);
    await this.typeByLabel(A11y.inputTelefone, phone);

    return this;
  }
}

export default LeadInfoScreen;
