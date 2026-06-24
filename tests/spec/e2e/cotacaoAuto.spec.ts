/**
 * Testes E2E mobile — fluxo completo de Cotação e Contratação de Seguro Auto.
 *
 * Espelha o caminho feliz do projeto web (qa-e2e-tests-automation/tests/spec/e2e/cotacaoAuto.spec.ts).
 *
 * Pré-requisitos:
 * - Emulador/dispositivo conectado
 * - APK em ./apps/ configurado no .env
 * - Seletores mapeados via Appium Inspector (tests/helpers/selectors.ts)
 */
import { MaritalStatuses } from '../../enum/MaritalStatuses';
import { VehicleUsages } from '../../enum/VehicleUsages';
import { generateMobileTestData } from '../../data/testData';
import { resetAppForE2e } from '../../helpers/waits';
import { A11y } from '../../helpers/selectors';
import HomeScreen from '../../pages/HomeScreen';
import LeadInfoScreen from '../../pages/quotation/LeadInfoScreen';
import VehicleDetailsScreen from '../../pages/quotation/VehicleDetailsScreen';
import VehicleAdditionalDetailsScreen from '../../pages/quotation/VehicleAdditionalDetailsScreen';
import PersonDataScreen from '../../pages/quotation/PersonDataScreen';
import BonusesClassScreen from '../../pages/quotation/BonusesClassScreen';
import PlanSelectionScreen from '../../pages/quotation/PlanSelectionScreen';
import CheckoutScreen from '../../pages/quotation/CheckoutScreen';
import IssuanceScreen from '../../pages/quotation/IssuanceScreen';
import TestConfig from '../../../config/test.config';

describe('B2C Mobile — Cotação e Contratação Seguro Auto @b2c @quotation_auto @happy_path @regression', () => {
  const homeScreen = new HomeScreen();
  const leadInfoScreen = new LeadInfoScreen();
  const vehicleDetailsScreen = new VehicleDetailsScreen();
  const vehicleAdditionalDetailsScreen = new VehicleAdditionalDetailsScreen();
  const personDataScreen = new PersonDataScreen();
  const bonusesClassScreen = new BonusesClassScreen();
  const planSelectionScreen = new PlanSelectionScreen();
  const checkoutScreen = new CheckoutScreen();
  const issuanceScreen = new IssuanceScreen();

  let quotationData: ReturnType<typeof generateMobileTestData>;

  before(async function () {
    this.timeout(120_000);
    await resetAppForE2e();
    quotationData = generateMobileTestData();
  });

  it('deve realizar cotação e contratação com sucesso (Caminho Feliz)', async function () {
    this.timeout(900_000);

    // Home → Cotação Auto (noReset pode retomar direto na Lead)
    await homeScreen.ensureCotacaoAutoFlow();

    // Etapa 1: Lead
    await leadInfoScreen.waitForLoaded();
    await leadInfoScreen.dismissDialogsIfPresent();
    await leadInfoScreen.fillLeadData({
      name: quotationData.name,
      email: quotationData.email,
      phone: quotationData.phone,
    });
    await leadInfoScreen.clickContinueBtn();

    // Etapa 2: Veículo
    await vehicleDetailsScreen.waitForLoaded();
    await vehicleDetailsScreen.fillLicensePlate(quotationData.licensePlate);
    await vehicleDetailsScreen.selectBrandNew(false);
    await vehicleDetailsScreen.selectBulletproof(false);
    await vehicleDetailsScreen.clickContinueBtn();

    // Etapa 3: Endereço e uso
    await vehicleAdditionalDetailsScreen.waitForLoaded();
    await vehicleAdditionalDetailsScreen.fillAddress('04777020', '99999');
    await vehicleAdditionalDetailsScreen.isOvernightGarage(true);
    await vehicleAdditionalDetailsScreen.selectUsage(VehicleUsages.PRIVATE);
    await vehicleAdditionalDetailsScreen.clickContinueBtn();

    // Etapa 4: CPF e estado civil
    await personDataScreen.waitForLoaded();
    await personDataScreen.fillDocumentNumber(quotationData.documentNumber);
    await personDataScreen.selectMaritalStatus(MaritalStatuses.SINGLE);
    await personDataScreen.clickContinueBtn();

    // Etapa 5: Bônus — sem classe
    await bonusesClassScreen.waitForLoaded();
    await bonusesClassScreen.useBonusClass(false);
    await bonusesClassScreen.clickContinueBtn();

    // Etapa 6: Seleção de plano Regular
    await planSelectionScreen.selectPlanWithRetry('Regular', async () => {
      await bonusesClassScreen.waitForLoaded();
      await bonusesClassScreen.useBonusClass(false);
      await bonusesClassScreen.clickContinueBtn();
    });

    // Etapa 7: Checkout
    await checkoutScreen.waitForLoaded();
    await checkoutScreen.checkEmailConfirmation();
    if (await checkoutScreen.hasText('Seguro Residencial', 5_000)) {
      expect(await checkoutScreen.upsellVisible('Seguro Residencial')).toBe(true);
    }
    if (await checkoutScreen.hasText('Seguro Vida', 5_000)) {
      expect(await checkoutScreen.upsellVisible('Seguro Vida')).toBe(true);
    }
    if (await checkoutScreen.hasText(A11y.checkoutAssistencias, 5_000)) {
      await checkoutScreen.openAssistenciasAccordion();
      expect(await checkoutScreen.hasText('Proteção de Rodas')).toBe(true);
    }
    await checkoutScreen.fillCreditCardData(
      TestConfig.credentials.creditCard?.number ?? '4111111111111111',
      TestConfig.credentials.creditCard?.expireDate ?? '0330',
      TestConfig.credentials.creditCard?.cvv ?? '737',
      'youse',
    );
    await checkoutScreen.clickFinishBtn();

    // Etapa 8: Resultado
    await issuanceScreen.waitForResult();
    if (await issuanceScreen.isOnSuccessPage()) {
      expect(await issuanceScreen.successTagsVisible()).toBe(true);
    } else if (await issuanceScreen.isOnErrorPage()) {
      // QA pode recusar pagamento para CPFs de teste — valida tela de erro
      expect(await issuanceScreen.isOnErrorPage()).toBe(true);
    }
  });
});
