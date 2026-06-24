/**
 * Matriz de regras de acessibilidade por tela cr\u00edtica do app Youse.
 *
 * Cada entrada descreve QUAIS elementos devem ser acess\u00edveis e QUAIS regras
 * aplicar. Edite aqui ao adicionar/remover telas \u2014 os specs em
 * `tests/spec/a11y/*` apenas referenciam estas matrizes.
 */
import { A11y } from '../selectors';
import type { A11yScreenMatrix } from './types';

export const HOME_MATRIX: A11yScreenMatrix = {
  name: 'Home',
  expectedLabels: [
    A11y.welcomeTitle,
    A11y.seguroAutoCard,
    A11y.seguroResidencialCard,
    A11y.seguroVidaCard,
    A11y.btnEntrarConta,
    A11y.btnCentralAjuda,
  ],
  gestureAlternatives: [A11y.seguroAutoCard],
};

export const LEAD_MATRIX: A11yScreenMatrix = {
  name: 'Lead',
  expectedLabels: [A11y.leadTitle, A11y.inputNome, A11y.inputEmail, A11y.inputTelefone, A11y.btnContinuar],
  inputs: [A11y.inputNome, A11y.inputEmail, A11y.inputTelefone],
};

export const VEHICLE_MATRIX: A11yScreenMatrix = {
  name: 'Veiculo',
  expectedLabels: [A11y.vehicleTitle, A11y.inputPlaca, A11y.switchZeroKm, A11y.btnContinuar],
  inputs: [A11y.inputPlaca],
};

export const PLAN_MATRIX: A11yScreenMatrix = {
  name: 'Planos',
  expectedLabels: [A11y.planTitle, A11y.btnQueroEsse],
  // Cards de plano costumam ter scroll horizontal \u2014 garante alternativa de bot\u00e3o
  gestureAlternatives: [A11y.btnQueroEsse],
};

export const CHECKOUT_MATRIX: A11yScreenMatrix = {
  name: 'Checkout',
  expectedLabels: [A11y.checkoutTitle, A11y.checkoutTotal, A11y.checkoutGoPayment, A11y.footerCompliance],
};

export const ALL_SCREEN_MATRIX: A11yScreenMatrix[] = [
  HOME_MATRIX,
  LEAD_MATRIX,
  VEHICLE_MATRIX,
  PLAN_MATRIX,
  CHECKOUT_MATRIX,
];
