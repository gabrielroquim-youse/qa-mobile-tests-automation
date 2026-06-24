/**
 * Spec a11y \u2014 tela de Ve\u00edculo (segunda etapa do funil).
 *
 * Cobre input \u00fanico (placa), switches e bot\u00f5es. \u00danica tela onde \u00e9 vi\u00e1vel
 * testar dynamic type sem invalidar dados de etapas posteriores.
 */
import HomeScreen from '../../pages/HomeScreen';
import LeadInfoScreen from '../../pages/quotation/LeadInfoScreen';
import VehicleDetailsScreen from '../../pages/quotation/VehicleDetailsScreen';
import { generateMobileTestData } from '../../data/testData';
import { resetAppForE2e } from '../../helpers/waits';
import { VEHICLE_MATRIX, expectA11yPassed, runA11yAudit, summarize } from '../../helpers/a11y';

describe('A11y \u2014 Ve\u00edculo @a11y @mobile @quotation_auto', () => {
  const homeScreen = new HomeScreen();
  const leadInfoScreen = new LeadInfoScreen();
  const vehicleDetailsScreen = new VehicleDetailsScreen();

  before(async function () {
    this.timeout(180_000);
    await resetAppForE2e();
    const data = generateMobileTestData();

    await homeScreen.ensureCotacaoAutoFlow();
    await leadInfoScreen.waitForLoaded();
    await leadInfoScreen.dismissDialogsIfPresent();
    await leadInfoScreen.fillLeadData({
      name: data.name,
      email: data.email,
      phone: data.phone,
    });
    await leadInfoScreen.clickContinueBtn();
    await vehicleDetailsScreen.waitForLoaded();
  });

  it('deve atender aos crit\u00e9rios de acessibilidade na tela de Ve\u00edculo', async function () {
    this.timeout(240_000);

    const report = await runA11yAudit(VEHICLE_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);
  });
});
