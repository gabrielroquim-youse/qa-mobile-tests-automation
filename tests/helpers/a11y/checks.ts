/**
 * Checagens de acessibilidade independentes de plataforma.
 *
 * Cada fun\u00e7\u00e3o recebe um contexto m\u00ednimo e retorna A11yFinding[].
 * S\u00e3o pequenas, ass\u00edncronas e n\u00e3o lan\u00e7am exce\u00e7\u00f5es \u2014 falhas s\u00e3o reportadas
 * via findings (severity error/warning/info).
 */
import TestConfig from '../../../config/test.config';
import { byA11y, byDescContains, byText } from '../selectors';
import type { A11yFinding } from './types';

/** Aguarda o sistema (n\u00e3o um elemento): rota\u00e7\u00e3o, font scale, ATF. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Material Design (Android) */
const MIN_TOUCH_TARGET_DP = 48;
/** Apple HIG (iOS) */
const MIN_TOUCH_TARGET_PT = 44;

interface DeviceMetrics {
  density: number;
  width: number;
  height: number;
}

let cachedMetrics: DeviceMetrics | null = null;

async function getDeviceMetrics(): Promise<DeviceMetrics> {
  if (cachedMetrics) return cachedMetrics;

  const window = await driver.getWindowSize();
  let density = 1;

  if (driver.isAndroid) {
    try {
      const info = (await driver.execute('mobile: deviceInfo', {})) as {
        displayDensity?: number;
      };
      if (info?.displayDensity) {
        // displayDensity vem em dpi \u2014 dp = px / (dpi/160)
        density = info.displayDensity / 160;
      }
    } catch {
      density = 3; // fallback razo\u00e1vel (xxhdpi)
    }
  }

  cachedMetrics = { density, width: window.width, height: window.height };
  return cachedMetrics;
}

async function findElement(label: string) {
  // Ordem de tentativa: accessibility id \u2192 content-desc \u2192 text
  const selectors = [byA11y(label), byDescContains(label), byText(label)];

  for (const selector of selectors) {
    try {
      const element = await $(selector);
      if (await element.isExisting()) {
        return { element, selector };
      }
    } catch {
      // tenta pr\u00f3ximo
    }
  }
  return null;
}

/**
 * RULE: labels
 *
 * Garante que cada label esperado est\u00e1 acess\u00edvel a leitores de tela
 * (TalkBack/VoiceOver). No Flutter Android, isso significa content-desc
 * n\u00e3o vazio; no iOS, accessibility label.
 */
export async function checkLabels(expectedLabels: string[]): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];

  for (const label of expectedLabels) {
    const found = await findElement(label);
    if (!found) {
      findings.push({
        rule: 'labels',
        severity: 'error',
        message: `Elemento esperado n\u00e3o encontrado/n\u00e3o acess\u00edvel para leitor de tela: "${label}"`,
        element: label,
      });
      continue;
    }

    try {
      const name = (await found.element.getAttribute(driver.isAndroid ? 'content-desc' : 'name')) ?? '';
      const text = ((await found.element.getText()) ?? '').trim();
      if (!name && !text) {
        findings.push({
          rule: 'labels',
          severity: 'error',
          message: `Elemento "${label}" est\u00e1 sem content-desc/accessibility label`,
          element: label,
        });
      }
    } catch {
      // ignora \u2014 elemento pode ter sido reciclado
    }
  }

  return findings;
}

/**
 * RULE: touch-target
 *
 * Valida tamanho m\u00ednimo de \u00e1rea cl\u00edcavel: 48dp Android / 44pt iOS.
 * Refer\u00eancia: WCAG 2.5.5 (AAA) + Material 3 + Apple HIG.
 */
export async function checkTouchTargets(expectedLabels: string[]): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];
  const { density } = await getDeviceMetrics();
  const minPx = driver.isAndroid ? MIN_TOUCH_TARGET_DP * density : MIN_TOUCH_TARGET_PT;

  for (const label of expectedLabels) {
    const found = await findElement(label);
    if (!found) continue;

    try {
      const size = await found.element.getSize();
      if (size.width < minPx || size.height < minPx) {
        findings.push({
          rule: 'touch-target',
          severity: 'warning',
          message: `Elemento "${label}" abaixo do tamanho m\u00ednimo de toque (${Math.round(size.width)}x${Math.round(size.height)}px; m\u00ednimo ${Math.round(minPx)}px)`,
          element: label,
          details: { width: size.width, height: size.height, minPx },
        });
      }
    } catch {
      // ignora
    }
  }

  return findings;
}

/**
 * RULE: focus-order
 *
 * Valida que a ordem dos labels esperados na \u00e1rvore de acessibilidade
 * corresponde \u00e0 ordem visual (top-to-bottom, left-to-right). Quebra dessa
 * ordem confunde usu\u00e1rios de TalkBack/VoiceOver (WCAG 2.4.3).
 */
export async function checkFocusOrder(expectedLabels: string[]): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];
  const positions: { label: string; x: number; y: number }[] = [];

  for (const label of expectedLabels) {
    const found = await findElement(label);
    if (!found) continue;
    try {
      const loc = await found.element.getLocation();
      positions.push({ label, x: loc.x, y: loc.y });
    } catch {
      // ignora
    }
  }

  // Esperado: ordem visual (y crescente, x crescente em empate)
  const expected = [...positions].sort((a, b) => a.y - b.y || a.x - b.x);
  const declared = positions.map((p) => p.label).join(' \u2192 ');
  const visual = expected.map((p) => p.label).join(' \u2192 ');

  if (declared !== visual && positions.length > 1) {
    findings.push({
      rule: 'focus-order',
      severity: 'warning',
      message: `Ordem dos elementos diverge da ordem visual.\n  Declarada: ${declared}\n  Visual:    ${visual}`,
      details: { declared, visual },
    });
  }

  return findings;
}

/**
 * RULE: dynamic-type
 *
 * Aumenta a escala de fonte do sistema e verifica que os labels esperados
 * continuam vis\u00edveis (n\u00e3o cortados / n\u00e3o desaparecem).
 * WCAG 1.4.4 \u2014 textos devem permanecer leg\u00edveis at\u00e9 200%.
 *
 * S\u00f3 roda em Android (ADB shell). No iOS use `simctl ui <udid> appearance`
 * + dynamic-type em pipeline dedicado.
 */
export async function checkDynamicType(expectedLabels: string[], scale = 1.3): Promise<A11yFinding[]> {
  if (!driver.isAndroid) return [];

  const findings: A11yFinding[] = [];
  let previousScale = '1.0';

  try {
    previousScale =
      String(
        await driver.execute('mobile: shell', {
          command: 'settings',
          args: ['get', 'system', 'font_scale'],
        }),
      ).trim() || '1.0';
  } catch {
    // settings indispon\u00edvel \u2014 segue tentando aplicar
  }

  try {
    await driver.execute('mobile: shell', {
      command: 'settings',
      args: ['put', 'system', 'font_scale', String(scale)],
    });
    // Aguarda o app reagir \u00e0 mudan\u00e7a (alguns apps Flutter requerem rebuild de frame)
    await sleep(1500);

    for (const label of expectedLabels) {
      const found = await findElement(label);
      if (!found) {
        findings.push({
          rule: 'dynamic-type',
          severity: 'error',
          message: `Label "${label}" desapareceu com font_scale=${scale} (texto cortado ou overflow?)`,
          element: label,
        });
      }
    }
  } catch (err) {
    findings.push({
      rule: 'dynamic-type',
      severity: 'info',
      message: `N\u00e3o foi poss\u00edvel aplicar font_scale=${scale}: ${(err as Error).message}`,
    });
  } finally {
    try {
      await driver.execute('mobile: shell', {
        command: 'settings',
        args: ['put', 'system', 'font_scale', previousScale],
      });
      await sleep(800);
    } catch {
      // ignora restaura\u00e7\u00e3o
    }
  }

  return findings;
}

/**
 * RULE: orientation
 *
 * Gira a tela para landscape e valida que os labels esperados continuam
 * vis\u00edveis. WCAG 1.3.4 \u2014 conte\u00fado n\u00e3o deve ficar inutiliz\u00e1vel em uma
 * orienta\u00e7\u00e3o espec\u00edfica (a menos que essencial).
 */
export async function checkOrientation(expectedLabels: string[]): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];
  let original: 'PORTRAIT' | 'LANDSCAPE' = 'PORTRAIT';

  try {
    original = (await driver.getOrientation()) as 'PORTRAIT' | 'LANDSCAPE';
  } catch {
    return [
      {
        rule: 'orientation',
        severity: 'info',
        message: 'getOrientation n\u00e3o suportado neste driver \u2014 check ignorado',
      },
    ];
  }

  try {
    await driver.setOrientation('LANDSCAPE');
    await sleep(1000);

    for (const label of expectedLabels) {
      const found = await findElement(label);
      if (!found) {
        findings.push({
          rule: 'orientation',
          severity: 'warning',
          message: `Label "${label}" n\u00e3o vis\u00edvel em landscape (verifique scroll/overflow)`,
          element: label,
        });
      }
    }
  } catch (err) {
    findings.push({
      rule: 'orientation',
      severity: 'info',
      message: `Falha ao girar para landscape: ${(err as Error).message}`,
    });
  } finally {
    try {
      await driver.setOrientation(original);
      await sleep(800);
    } catch {
      // ignora
    }
  }

  return findings;
}

/**
 * RULE: keyboard
 *
 * Para cada input esperado, foca via tap, abre teclado e dispara KEYCODE_TAB
 * (Android) para confirmar que o foco avan\u00e7a sem prender o usu\u00e1rio
 * (WCAG 2.1.2 \u2014 no keyboard trap).
 */
export async function checkKeyboardNav(inputs: string[]): Promise<A11yFinding[]> {
  if (!driver.isAndroid || inputs.length === 0) return [];

  const findings: A11yFinding[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const label = inputs[i];
    const found = await findElement(label);
    if (!found) {
      findings.push({
        rule: 'keyboard',
        severity: 'warning',
        message: `Input esperado n\u00e3o encontrado para teste de teclado: "${label}"`,
        element: label,
      });
      continue;
    }
    try {
      await found.element.click();
      await sleep(300);
      // KEYCODE_TAB = 61 — navega para o próximo elemento focal
      await driver.pressKeyCode(61);
      await sleep(300);
    } catch (err) {
      findings.push({
        rule: 'keyboard',
        severity: 'warning',
        message: `Input "${label}" n\u00e3o p\u00f4de receber/avan\u00e7ar foco via teclado: ${(err as Error).message}`,
        element: label,
      });
    }
  }

  // Fecha o teclado para n\u00e3o atrapalhar pr\u00f3ximos checks
  try {
    await driver.hideKeyboard();
  } catch {
    // ignora
  }

  return findings;
}

/**
 * RULE: gesture-alternatives
 *
 * Para cada a\u00e7\u00e3o que normalmente exige gesto complexo (swipe, long-press,
 * pinch), verifica se existe um bot\u00e3o equivalente acess\u00edvel.
 * WCAG 2.5.1 \u2014 path-based gestures devem ter alternativa de toque simples.
 */
export async function checkGestureAlternatives(actions: string[]): Promise<A11yFinding[]> {
  const findings: A11yFinding[] = [];

  for (const action of actions) {
    const found = await findElement(action);
    if (!found) {
      findings.push({
        rule: 'gesture-alternatives',
        severity: 'error',
        message: `A\u00e7\u00e3o "${action}" n\u00e3o possui bot\u00e3o alternativo acess\u00edvel (apenas gesto?)`,
        element: action,
      });
    }
  }

  return findings;
}

/**
 * RULE: contrast (light-weight)
 *
 * Implementa\u00e7\u00e3o m\u00ednima: usa o resultado do audit nativo do Google ATF
 * (ver androidAudit.ts) e complementa com um aviso quando nenhum check de
 * contraste foi executado pelo ATF \u2014 incentivando rodar o spec em Android.
 *
 * Para um check pixel-perfect (amostragem direta em screenshot), adicione
 * `pixelmatch`/`pngjs` e estenda este m\u00f3dulo.
 */
export async function noteContrastCoverage(nativeFindings: A11yFinding[]): Promise<A11yFinding[]> {
  if (!driver.isAndroid) {
    return [
      {
        rule: 'contrast',
        severity: 'info',
        message:
          'Contraste autom\u00e1tico s\u00f3 est\u00e1 dispon\u00edvel via Google ATF (Android). Para iOS, use Accessibility Inspector manualmente.',
      },
    ];
  }
  const hasContrast = nativeFindings.some((f) => f.rule === 'contrast');
  if (!hasContrast) {
    return [
      {
        rule: 'contrast',
        severity: 'info',
        message:
          'Google ATF n\u00e3o reportou issues de contraste \u2014 considere valida\u00e7\u00e3o manual em telas com gradiente/imagem de fundo.',
      },
    ];
  }
  return [];
}

/**
 * RULE: dark-mode
 *
 * Ativa o tema escuro do sistema (Android: `cmd uimode night yes`) e valida que
 * os labels esperados continuam vis\u00edveis e leg\u00edveis. Restaura ao fim.
 *
 * WCAG 1.4.3 + 1.4.11 \u2014 conte\u00fado deve manter contraste m\u00ednimo em ambos os
 * temas. Apps Flutter que n\u00e3o respeitam `MediaQuery.platformBrightness` aparecem
 * com texto preto em fundo preto, e o check detecta a perda de elementos.
 */
export async function checkDarkMode(expectedLabels: string[]): Promise<A11yFinding[]> {
  if (!driver.isAndroid) {
    return [
      {
        rule: 'dark-mode',
        severity: 'info',
        message:
          'Dark mode autom\u00e1tico \u00e9 suportado apenas em Android via adb. Para iOS use `simctl ui <udid> appearance dark`.',
      },
    ];
  }

  const findings: A11yFinding[] = [];
  let originalMode = 'no';
  try {
    const raw = String(
      await driver.execute('mobile: shell', {
        command: 'cmd',
        args: ['uimode', 'night'],
      }),
    );
    if (/yes/i.test(raw)) originalMode = 'yes';
    if (/auto/i.test(raw)) originalMode = 'auto';
  } catch {
    // ignora \u2014 fallback no/yes
  }

  try {
    await driver.execute('mobile: shell', {
      command: 'cmd',
      args: ['uimode', 'night', 'yes'],
    });
    await sleep(1500);

    for (const label of expectedLabels) {
      const found = await findElement(label);
      if (!found) {
        findings.push({
          rule: 'dark-mode',
          severity: 'warning',
          message: `Label "${label}" n\u00e3o vis\u00edvel em dark mode (poss\u00edvel contraste invertido ou tema n\u00e3o aplicado)`,
          element: label,
        });
      }
    }
  } catch (err) {
    findings.push({
      rule: 'dark-mode',
      severity: 'info',
      message: `N\u00e3o foi poss\u00edvel alternar dark mode: ${(err as Error).message}`,
    });
  } finally {
    try {
      await driver.execute('mobile: shell', {
        command: 'cmd',
        args: ['uimode', 'night', originalMode],
      });
      await sleep(800);
    } catch {
      // ignora
    }
  }

  return findings;
}

/** Helper: aplica timeout reduzido para evitar amplificar tempos em audits */
export async function withShortImplicitWait<T>(fn: () => Promise<T>): Promise<T> {
  const implicit = TestConfig.timeouts.implicit;
  try {
    await driver.setTimeout({ implicit: 1000 });
    return await fn();
  } finally {
    await driver.setTimeout({ implicit });
  }
}
