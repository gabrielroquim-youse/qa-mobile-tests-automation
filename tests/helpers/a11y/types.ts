/**
 * Tipos compartilhados pela su\u00edte de acessibilidade mobile.
 *
 * Refer\u00eancias:
 * - WCAG 2.2 AA (https://www.w3.org/TR/WCAG22/)
 * - W3C Mobile Accessibility (https://www.w3.org/TR/mobile-accessibility-mapping/)
 * - Material Design Accessibility (\u2265 48dp)
 * - Apple HIG Accessibility (\u2265 44pt)
 */

export type A11yRuleId =
  | 'labels'
  | 'touch-target'
  | 'focus-order'
  | 'contrast'
  | 'dynamic-type'
  | 'orientation'
  | 'keyboard'
  | 'gesture-alternatives'
  | 'dark-mode';

export type A11ySeverity = 'error' | 'warning' | 'info';

export interface A11yFinding {
  rule: A11yRuleId;
  severity: A11ySeverity;
  message: string;
  /** Identificador human-readable do elemento (label, content-desc ou xpath curto) */
  element?: string;
  /** Dados extras (tamanho, contraste, etc.) */
  details?: Record<string, unknown>;
}

export interface A11yReport {
  screen: string;
  platform: 'android' | 'ios';
  findings: A11yFinding[];
  /** true quando n\u00e3o h\u00e1 findings com severity error */
  passed: boolean;
}

export interface A11yScreenMatrix {
  /** Nome da tela (para report) */
  name: string;
  /**
   * Labels que DEVEM ser an\u00fanciaveis pelo leitor de tela (content-desc / accessibility label).
   * Use a constante A11y do helpers/selectors quando poss\u00edvel.
   */
  expectedLabels: string[];
  /**
   * A\u00e7\u00f5es que precisam ter alternativa por bot\u00e3o (n\u00e3o exclusivamente gesto).
   * Ex.: "fechar modal", "remover item". Vazio = sem gestos cr\u00edticos.
   */
  gestureAlternatives?: string[];
  /** Inputs (label/content-desc) presentes na tela para checagem de teclado/foco */
  inputs?: string[]; /**
   * Labels que devem passar pela checagem de contraste pixel-perfect.
   * Default: todos de `expectedLabels`. Use para EXCLUIR ícones decorativos
   * sobre imagem (que causam falsos positivos).
   */
  contrastTargets?: string[];
  /** Threshold custom de contraste (default 4.5:1 — WCAG AA texto normal). */
  contrastThreshold?: number; /** Regras a aplicar nesta tela. Padr\u00e3o: todas. */
  rules?: A11yRuleId[];
}
