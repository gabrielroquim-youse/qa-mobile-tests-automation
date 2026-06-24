/**
 * Etapa 6 — Seleção de plano (mobile).
 */
import { A11y, byDescContains } from '../../helpers/selectors';
import { sleep } from '../../helpers/waits';
import QuotationScreenLayout from './QuotationScreenLayout';

export type PlanName = 'Essencial' | 'Regular' | 'Auto 1504' | 'Personalizado';

const PLAN_INDEX: Partial<Record<PlanName, number>> = {
  Essencial: 0,
  Regular: 1,
  'Auto 1504': 2,
};

type PlanScreenState = 'loading' | 'plans' | 'error';

export class PlanSelectionScreen extends QuotationScreenLayout {
  private async isPricingLoading(): Promise<boolean> {
    return (
      (await this.hasTextQuick(A11y.planLoading)) ||
      (await this.hasTextQuick('montando o seu seguro')) ||
      (await this.hasTextQuick('estamos montando'))
    );
  }

  private async isPricingError(): Promise<boolean> {
    return (
      (await this.hasTextQuick(A11y.issuanceErrorTitle)) ||
      (await this.hasTextQuick(A11y.planErrorNetwork)) ||
      (await this.hasTextQuick('tente novamente'))
    );
  }

  async dismissPricingErrorIfPresent(): Promise<boolean> {
    if (!(await this.isPricingError())) return false;

    for (const label of [A11y.btnLgpdOk, A11y.btnOkEntendi, 'OK, ENTENDI']) {
      if (await this.hasText(label, 3_000)) {
        await this.tapByLabel(label);
        await sleep(1_500);
        return true;
      }
    }

    try {
      await driver.back();
      await sleep(1_000);
      return true;
    } catch {
      return false;
    }
  }

  async waitForLoaded(): Promise<void> {
    const state = await driver.waitUntil(
      async (): Promise<PlanScreenState | false> => {
        if (await this.isPricingError()) return 'error';
        if (await this.hasTextQuick(A11y.planTitle)) return 'plans';
        if (await this.isPricingLoading()) return 'loading';
        if ((await this.hasTextQuick(A11y.btnQueroEsse)) || (await this.hasTextQuick('/mês'))) return 'plans';
        return false;
      },
      {
        timeout: 180_000,
        interval: 2_000,
        timeoutMsg: 'Tela de planos não carregou (precificação)',
      },
    );

    if (state === 'error') {
      throw new Error(
        'API de planos falhou no device — verifique Wi‑Fi/dados móveis (tela: "Não conseguimos continuar a contratação")',
      );
    }
  }

  async waitForPlansReady(): Promise<void> {
    await driver.waitUntil(
      async () => {
        if (await this.isPricingError()) return false;
        if (await this.isPricingLoading()) return false;
        return (
          (await this.hasTextQuick(A11y.btnQueroEsse)) ||
          (await this.hasTextQuick('Quero esse')) ||
          (await this.hasTextQuick('/mês'))
        );
      },
      {
        timeout: 240_000,
        interval: 2_000,
        timeoutMsg: 'Planos não carregaram dentro do timeout (API de precificação)',
      },
    );
  }

  private planLabels(planName: PlanName): string[] {
    if (planName === 'Auto 1504') return ['Auto 1504', 'Plano auto personalizado 1504', '1504'];
    if (planName === 'Personalizado') return ['Do seu jeito', 'Personalizado', 'Quero personalizar'];
    return [`Plano ${planName}`, planName];
  }

  /** Seletor do CTA "Quero esse" dentro do card do plano (Flutter content-desc) */
  private planCardCtaSelector(planName: PlanName): string {
    const escapedPlan = planName.replace(/"/g, '\\"');
    const escapedCta = A11y.btnQueroEsse.replace(/"/g, '\\"');
    if (driver.isAndroid) {
      return `//android.view.View[contains(@content-desc,"${escapedPlan}")]/ancestor::*[.//*[contains(@content-desc,"${escapedCta}")]][1]//*[contains(@content-desc,"${escapedCta}")]`;
    }
    return `-ios class chain:**/XCUIElementTypeOther[\`label CONTAINS "${escapedPlan}"\`][1]/**/XCUIElementTypeButton[\`label CONTAINS "${escapedCta}"\`]`;
  }

  async selectPlan(planName: PlanName): Promise<void> {
    await this.waitForPlansReady();

    for (const label of this.planLabels(planName)) {
      try {
        await this.scrollToText(label, 12_000);
      } catch {
        // card pode já estar visível sem scroll
      }
      if (await this.hasTextQuick(label)) break;
    }

    const ctaSelector = this.planCardCtaSelector(planName);
    if (await this.isVisible(ctaSelector, 4_000)) {
      await this.tap(ctaSelector);
      return;
    }

    const ctaButtons = await $$(byDescContains(A11y.btnQueroEsse));
    const ctaCount = await ctaButtons.length;
    const planIndex = PLAN_INDEX[planName];
    if (planIndex !== undefined && ctaCount > planIndex) {
      await ctaButtons[planIndex].click();
      return;
    }

    for (const button of ctaButtons) {
      if (await button.isDisplayed()) {
        await button.click();
        return;
      }
    }

    throw new Error(`Botão "${A11y.btnQueroEsse}" não encontrado no card do plano "${planName}"`);
  }

  /** Aguarda planos e seleciona — com 1 retry se a API de precificação falhar */
  async selectPlanWithRetry(planName: PlanName, retryFromBonus: () => Promise<void>): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.waitForLoaded();
        await this.selectPlan(planName);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const retriable = message.includes('API de planos') || message.includes('precificação');
        if (!retriable || attempt === 2) throw error;

        await this.dismissPricingErrorIfPresent();
        await sleep(3_000);
        await retryFromBonus();
      }
    }
  }

  async planCardContains(planName: PlanName, keyword: string): Promise<boolean> {
    await this.waitForPlansReady();
    for (const label of this.planLabels(planName)) {
      try {
        await this.scrollToText(label, 8_000);
      } catch {
        // ignore
      }
    }
    return (await this.hasText(keyword)) && (await this.hasText(planName));
  }
}

export default PlanSelectionScreen;
