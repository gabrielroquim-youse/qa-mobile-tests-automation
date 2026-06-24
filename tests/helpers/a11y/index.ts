/**
 * Ponto de entrada \u00fanico para a su\u00edte de acessibilidade.
 * Importe daqui nos specs:
 *
 *   import { runA11yAudit, expectA11yPassed, HOME_MATRIX } from '../../helpers/a11y';
 */
export * from './types';
export * from './runner';
export * from './matrix';
export { checkContrastPixelPerfect } from './contrast';
