/**
 * Spec de acessibilidade do FUNIL completo (Lead → Veículo → Pessoa → Planos → Checkout).
 *
 * Reaproveita a mesma sessão WDIO para auditar todas as telas críticas do
 * caminho feliz, evitando o custo de re-instalar o app entre specs. Tags
 * `@journey` o destacam dos smokes (`@smoke`) que ficam restritos à Home.
 *
 * Para rodar só esse spec:
 *   npm run test:a11y -- --spec ./tests/spec/a11y/funnel.a11y.spec.ts
 */
import { MaritalStatuses } from '../../enum/MaritalStatuses';
import { VehicleUsages } from '../../enum/VehicleUsages';
import { generateMobileTestData } from '../../data/testData';
import { resetAppForE2e } from '../../helpers/waits';
import HomeScreen from '../../pages/HomeScreen';
import LeadInfoScreen from '../../pages/quotation/LeadInfoScreen';
import VehicleDetailsScreen from '../../pages/quotation/VehicleDetailsScreen';
import VehicleAdditionalDetailsScreen from '../../pages/quotation/VehicleAdditionalDetailsScreen';
import PersonDataScreen from '../../pages/quotation/PersonDataScreen';
import BonusesClassScreen from '../../pages/quotation/BonusesClassScreen';
import PlanSelectionScreen from '../../pages/quotation/PlanSelectionScreen';
import CheckoutScreen from '../../pages/quotation/CheckoutScreen';
import {
  CHECKOUT_MATRIX,
  LEAD_MATRIX,
  PLAN_MATRIX,
  VEHICLE_MATRIX,
  expectA11yPassed,
  runA11yAudit,
  summarize,
} from '../../helpers/a11y';

describe('A11y — Funil completo @a11y @journey @mobile', () => {
  const homeScreen = new HomeScreen();
  const leadInfoScreen = new LeadInfoScreen();
  const vehicleDetailsScreen = new VehicleDetailsScreen();
  const vehicleAdditionalDetailsScreen = new VehicleAdditionalDetailsScreen();
  const personDataScreen = new PersonDataScreen();
  const bonusesClassScreen = new BonusesClassScreen();
  const planSelectionScreen = new PlanSelectionScreen();
  const checkoutScreen = new CheckoutScreen();

  let quotationData: ReturnType<typeof generateMobileTestData>;

  before(async function () {
    this.timeout(120_000);
    await resetAppForE2e();
    quotationData = generateMobileTestData();
    await homeScreen.ensureCotacaoAutoFlow();
  });

  it('Lead — atende WCAG 2.2 AA', async function () {
    this.timeout(120_000);
    await leadInfoScreen.waitForLoaded();
    await leadInfoScreen.dismissDialogsIfPresent();

    const report = await runA11yAudit(LEAD_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);

    await leadInfoScreen.fillLeadData({
      name: quotationData.name,
      email: quotationData.email,
      phone: quotationData.phone,
    });
    await leadInfoScreen.clickContinueBtn();
  });

  it('Veiculo — atende WCAG 2.2 AA', async function () {
    this.timeout(120_000);
    await vehicleDetailsScreen.waitForLoaded();

    const report = await runA11yAudit(VEHICLE_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);

    await vehicleDetailsScreen.fillLicensePlate(quotationData.licensePlate);
    await vehicleDetailsScreen.selectBrandNew(false);
    await vehicleDetailsScreen.selectBulletproof(false);
    await vehicleDetailsScreen.clickContinueBtn();

    await vehicleAdditionalDetailsScreen.waitForLoaded();
    await vehicleAdditionalDetailsScreen.fillAddress('04777020', '99999');
    await vehicleAdditionalDetailsScreen.isOvernightGarage(true);
    await vehicleAdditionalDetailsScreen.selectUsage(VehicleUsages.PRIVATE);
    await vehicleAdditionalDetailsScreen.clickContinueBtn();

    await personDataScreen.waitForLoaded();
    await personDataScreen.fillDocumentNumber(quotationData.documentNumber);
    await personDataScreen.selectMaritalStatus(MaritalStatuses.SINGLE);
    await personDataScreen.clickContinueBtn();

    await bonusesClassScreen.waitForLoaded();
    await bonusesClassScreen.useBonusClass(false);
    await bonusesClassScreen.clickContinueBtn();
  });

  it('Planos — atende WCAG 2.2 AA', async function () {
    this.timeout(180_000);
    await planSelectionScreen.waitForLoaded();

    const report = await runA11yAudit(PLAN_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);

    await planSelectionScreen.selectPlanWithRetry('Regular', async () => {
      await bonusesClassScreen.waitForLoaded();
      await bonusesClassScreen.useBonusClass(false);
      await bonusesClassScreen.clickContinueBtn();
    });
  });

  it('Checkout — atende WCAG 2.2 AA', async function () {
    this.timeout(120_000);
    await checkoutScreen.waitForLoaded();

    const report = await runA11yAudit(CHECKOUT_MATRIX);
    console.log(summarize(report));
    expectA11yPassed(report);
  });
});
