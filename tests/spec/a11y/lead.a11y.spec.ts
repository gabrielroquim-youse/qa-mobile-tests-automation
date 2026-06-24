/**
 * Spec a11y \u2014 tela de Lead (primeira etapa do funil de cota\u00e7\u00e3o).
 *
 * Valida labels, touch targets, foco de teclado nos inputs e ordem visual.
 */
import HomeScreen from '../../pages/HomeScreen';
import LeadInfoScreen from '../../pages/quotation/LeadInfoScreen';
import { resetAppForE2e } from '../../helpers/waits';
import { LEAD_MATRIX, expectA11yPassed, runA11yAudit, summarize } from '../../helpers/a11y';

describe('A11y \u2014 Lead @a11y @mobile @quotation_auto', () => {
  const homeScreen = new HomeScreen();
  const leadInfoScreen = new LeadInfoScreen();

  before(async function () {
    this.timeout(120_000);
    await resetAppForE2e();
    await homeScreen.ensureCotacaoAutoFlow();
    await leadInfoScreen.waitForLoaded();
    await leadInfoScreen.dismissDialogsIfPresent();
  });

  it('deve expor labels, touch targets e foco corretos na tela Lead', async function () {
    this.timeout(180_000);

    const report = await runA11yAudit(LEAD_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);
  });
});
