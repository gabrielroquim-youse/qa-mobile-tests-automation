/**
 * Spec smoke de acessibilidade \u2014 valida a Home do app.
 *
 * Executa Google ATF + checks WCAG 2.2 AA (labels, touch target, foco,
 * dynamic type, orienta\u00e7\u00e3o, gestos alternativos). Sempre que poss\u00edvel,
 * mantenha esse spec dentro do CI \u2014 ele \u00e9 r\u00e1pido e detecta regress\u00f5es
 * estruturais cedo.
 */
import HomeScreen from '../../pages/HomeScreen';
import { waitForAppReady } from '../../helpers/waits';
import { HOME_MATRIX, expectA11yPassed, runA11yAudit, summarize } from '../../helpers/a11y';

describe('A11y \u2014 Home @a11y @smoke @mobile', () => {
  const homeScreen = new HomeScreen();

  before(async () => {
    await waitForAppReady();
    const loaded = await homeScreen.isLoaded();
    expect(loaded).toBe(true);
  });

  it('deve atender aos crit\u00e9rios m\u00ednimos de acessibilidade (WCAG 2.2 AA)', async function () {
    this.timeout(120_000);

    const report = await runA11yAudit(HOME_MATRIX);

    // Log human-readable nos relat\u00f3rios (spec/allure)
    console.log(summarize(report));

    expectA11yPassed(report);
  });
});
