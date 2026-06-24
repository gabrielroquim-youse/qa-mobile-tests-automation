/**
 * Classe base para Screen Objects mobile.
 *
 * Encapsula interações comuns com elementos nativos via WebdriverIO/Appium.
 * Classes filhas definem seletores específicos de cada tela do app.
 */
import { A11y, byA11y, byDescContains, byHint, byText } from '../helpers/selectors';
import { hideKeyboard } from '../helpers/waits';
import TestConfig from '../../config/test.config';

export class BaseScreen {
  /** Aguarda elemento ficar visível e retorna a chainable element */
  protected async waitForVisible(selector: string, timeout = 10_000) {
    const implicit = TestConfig.timeouts.implicit;
    try {
      await driver.setTimeout({ implicit: 0 });
      const element = await $(selector);
      await element.waitForDisplayed({ timeout });
      return element;
    } finally {
      await driver.setTimeout({ implicit });
    }
  }

  /** Tap em elemento após aguardar visibilidade */
  protected async tap(selector: string, timeout = 10_000) {
    const element = await this.waitForVisible(selector, timeout);
    await element.click();
  }

  /** Tap por texto visível (fallback quando não há accessibility id) */
  protected async tapByText(text: string, exact = false, timeout = 10_000) {
    await this.tap(byText(text, exact), timeout);
  }

  /** Tap por accessibility id */
  protected async tapByA11y(id: string, timeout = 10_000) {
    await this.tap(byA11y(id), timeout);
  }

  /** Tap por label Flutter (content-desc) com fallback para text nativo */
  protected async tapByLabel(label: string, timeout = 10_000) {
    const descSelector = byDescContains(label);
    if (await this.isVisible(descSelector, 3_000)) {
      await this.tap(descSelector, timeout);
      return;
    }
    if (await this.isVisible(byA11y(label), 2_000)) {
      await this.tap(byA11y(label), timeout);
      return;
    }
    await this.tapByText(label, false, timeout);
  }

  /** Preenche campo de texto — clica antes para focar (Flutter EditText) */
  protected async type(selector: string, value: string, timeout = 10_000) {
    const element = await this.waitForVisible(selector, timeout);
    await element.click();
    try {
      await element.clearValue();
    } catch {
      // Flutter pode não suportar clearValue
    }
    try {
      await element.setValue(value);
    } catch {
      await driver.keys(value);
    }
    await hideKeyboard();
  }

  /** Preenche campo tocando no hint (EditText) ou label Flutter (content-desc) */
  protected async typeByLabel(label: string, value: string) {
    const hintSelector = byHint(label);
    if (await this.isVisible(hintSelector, 2_000)) {
      await this.type(hintSelector, value);
      return;
    }
    await this.tapByLabel(label);
    await driver.keys(value);
    await hideKeyboard();
  }

  /** @deprecated Use typeByLabel — mantido por compatibilidade */
  protected async typeByA11yOrLabel(_a11yId: string, label: string, value: string) {
    await this.typeByLabel(label, value);
  }

  /** Verifica se elemento está visível (implicit wait desligado para não multiplicar timeouts) */
  protected async isVisible(selector: string, timeout = 5_000): Promise<boolean> {
    const implicit = TestConfig.timeouts.implicit;
    try {
      await driver.setTimeout({ implicit: 0 });
      const element = await $(selector);
      return await element.waitForDisplayed({ timeout });
    } catch {
      return false;
    } finally {
      await driver.setTimeout({ implicit });
    }
  }

  /** Verifica se texto/label está visível (text nativo ou content-desc Flutter) */
  async hasText(text: string, timeout = 5_000): Promise<boolean> {
    return (
      (await this.isVisible(byDescContains(text), timeout)) ||
      (await this.isVisible(byA11y(text), timeout)) ||
      (await this.isVisible(byText(text), timeout))
    );
  }

  /** Poll rápido — evita multiplicar timeouts dentro de waitUntil */
  protected async hasTextQuick(text: string): Promise<boolean> {
    return this.hasText(text, 800);
  }

  /** Obtém texto de um elemento */
  protected async getText(selector: string, timeout = 10_000): Promise<string> {
    const element = await this.waitForVisible(selector, timeout);
    return element.getText();
  }

  /** Scroll até texto/content-desc visível */
  protected async scrollToText(text: string, timeout = 10_000): Promise<void> {
    const escaped = text.replace(/"/g, '\\"');
    if (driver.isAndroid) {
      const byDesc = `android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().descriptionContains("${escaped}"))`;
      try {
        await $(byDesc).waitForExist({ timeout });
        return;
      } catch {
        const byTextSelector = `android=new UiScrollable(new UiSelector().scrollable(true).instance(0)).scrollIntoView(new UiSelector().textContains("${escaped}"))`;
        await $(byTextSelector).waitForExist({ timeout });
      }
      return;
    }
    await driver.execute('mobile: scroll', {
      direction: 'down',
      predicateString: `label CONTAINS "${escaped}"`,
    });
  }

  /** Scroll até elemento — usa scroll nativo quando possível */
  protected async scrollToElement(selector: string, timeout = 10_000) {
    if (driver.isAndroid && selector.includes('descriptionContains')) {
      const descMatch = selector.match(/descriptionContains\("([^"]+)"\)/);
      if (descMatch?.[1]) {
        await this.scrollToText(descMatch[1], timeout);
        return;
      }
    }
    if (driver.isAndroid && selector.includes('UiSelector().text')) {
      const textMatch = selector.match(/text(?:Contains)?\("([^"]+)"\)/);
      if (textMatch?.[1]) {
        await this.scrollToText(textMatch[1], timeout);
        return;
      }
    }
    if (driver.isAndroid) {
      await driver.execute('mobile: scrollGesture', {
        left: 100,
        top: 400,
        width: 200,
        height: 600,
        direction: 'down',
        percent: 0.75,
      });
      return;
    }
    await $(selector).scrollIntoView();
  }

  /** Tap no botão Continuar (comum em todo o funil — UI usa CONTINUAR em maiúsculas) */
  protected async tapContinuar() {
    await hideKeyboard();
    for (const label of [A11y.btnContinuar, A11y.btnContinuarAlt]) {
      const descSelector = byDescContains(label);
      if (await this.isVisible(descSelector, 2_000)) {
        await this.tap(descSelector);
        return;
      }
    }
    await this.tapByLabel(A11y.btnContinuar);
  }

  /** Alterna switch Flutter pelo label (content-desc) — se já está no estado desejado, ignora */
  protected async setSwitchByLabel(label: string, desired: boolean) {
    const labelSelector = byDescContains(label);
    if (!(await this.isVisible(labelSelector, 3_000))) return;

    const switchSelector = driver.isAndroid
      ? `//android.view.View[contains(@content-desc,"${label.replace(/"/g, '\\"')}"]//android.widget.Switch | //android.view.View[contains(@content-desc,"${label.replace(/"/g, '\\"')}"]/following-sibling::*[1]`
      : `-ios class chain:**/XCUIElementTypeSwitch[\`label CONTAINS "${label}"\`]`;

    if (await this.isVisible(switchSelector, 2_000)) {
      const element = await $(switchSelector);
      const checked =
        (await element.getAttribute('checked')) === 'true' || (await element.getAttribute('value')) === '1';
      if (checked !== desired) await element.click();
      return;
    }

    // Flutter: toggles às vezes são linhas clicáveis — toque no label se desejado=true
    if (desired) await this.tap(labelSelector);
  }
}

export default BaseScreen;
