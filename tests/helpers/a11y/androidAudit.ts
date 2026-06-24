/**
 * Wrapper para o comando nativo `mobile: performAccessibilityAudit` do
 * driver UiAutomator2.
 *
 * Esse comando executa o Google Accessibility Test Framework (ATF) na tela
 * atual e retorna issues categorizadas (touch target, contraste, content-desc,
 * etc.) sem precisar de depend\u00eancias extras.
 *
 * Docs: https://github.com/appium/appium-uiautomator2-driver#mobile-performaccessibilityaudit
 */
import type { A11yFinding, A11yRuleId } from './types';

interface AtfIssue {
  type?: string;
  /** Algumas vers\u00f5es do driver retornam typeNiceName em vez de type */
  typeNiceName?: string;
  message?: string;
  elementClassName?: string;
  elementResourceId?: string;
  elementContentDescription?: string;
  elementText?: string;
}

/** Mapeia o `type` retornado pelo ATF para nossas regras internas */
const ATF_TYPE_TO_RULE: Record<string, A11yRuleId> = {
  TouchTargetSizeCheck: 'touch-target',
  TextContrastCheck: 'contrast',
  ImageContrastCheck: 'contrast',
  SpeakableTextPresentCheck: 'labels',
  EditableContentDescCheck: 'labels',
  DuplicateClickableBoundsCheck: 'touch-target',
  DuplicateSpeakableTextCheck: 'labels',
  RedundantDescriptionCheck: 'labels',
  TraversalOrderCheck: 'focus-order',
  ClassNameCheck: 'labels',
  ClickableSpanCheck: 'labels',
  LinkPurposeUnclearCheck: 'labels',
};

function classifyRule(issue: AtfIssue): A11yRuleId {
  const key = issue.type ?? issue.typeNiceName ?? '';
  return ATF_TYPE_TO_RULE[key] ?? 'labels';
}

function describeElement(issue: AtfIssue): string | undefined {
  return (
    issue.elementContentDescription ||
    issue.elementText ||
    issue.elementResourceId ||
    issue.elementClassName ||
    undefined
  );
}

/**
 * Executa o audit nativo. Retorna [] se o driver/plataforma n\u00e3o suportar
 * (iOS ou drivers antigos) \u2014 nunca lan\u00e7a.
 */
export async function performNativeAccessibilityAudit(): Promise<A11yFinding[]> {
  if (!driver.isAndroid) return [];

  try {
    const raw = (await driver.execute('mobile: performAccessibilityAudit', {})) as unknown;
    const issues = (Array.isArray(raw) ? raw : []) as AtfIssue[];
    if (issues.length === 0) return [];

    return issues.map((issue) => ({
      rule: classifyRule(issue),
      severity: 'warning',
      message: issue.message ?? issue.typeNiceName ?? issue.type ?? 'ATF issue',
      element: describeElement(issue),
      details: { source: 'GoogleATF', type: issue.type ?? issue.typeNiceName },
    }));
  } catch {
    // Driver pode n\u00e3o ter o comando habilitado \u2014 tratamos como audit indispon\u00edvel
    return [];
  }
}
