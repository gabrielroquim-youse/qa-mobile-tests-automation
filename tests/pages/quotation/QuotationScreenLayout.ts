/**
 * Layout base compartilhado pelas telas do funil de cotação auto mobile.
 */
import { A11y } from '../../helpers/selectors';
import BaseScreen from '../BaseScreen';

export class QuotationScreenLayout extends BaseScreen {
  /** Fecha modais informativos (OK ENTENDI) — não confundir com links LGPD do formulário */
  async dismissDialogsIfPresent(): Promise<void> {
    for (const label of [A11y.btnLgpdOk, A11y.btnOkEntendi]) {
      if (await this.hasText(label, 2_000)) {
        await this.tapByLabel(label);
        return;
      }
    }
  }

  async clickContinueBtn(): Promise<void> {
    await this.dismissDialogsIfPresent();
    await this.tapContinuar();
  }
}

export default QuotationScreenLayout;
