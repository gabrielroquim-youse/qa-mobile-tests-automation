/**
 * Helpers de seletores cross-platform (Android UiAutomator2 / iOS XCUITest).
 *
 * App Youse (Flutter): elementos expõem labels via content-desc, não text.
 * Prioridade: accessibility id (content-desc) → descriptionContains → text.
 *
 * Labels mapeados do mob-flutter (quote_insurance, resource_flow, credit_card, i18n).
 */
export function byA11y(id: string): string {
  return `~${id}`;
}

/** Flutter/Android — busca por content-desc parcial (UiSelector.descriptionContains) */
export function byDescContains(text: string): string {
  const escaped = text.replace(/"/g, '\\"');
  if (driver.isAndroid) {
    return `android=new UiSelector().descriptionContains("${escaped}")`;
  }
  return `-ios predicate string:label CONTAINS "${text}"`;
}

export function byText(text: string, exact = false): string {
  if (driver.isAndroid) {
    const escaped = text.replace(/"/g, '\\"');
    return exact
      ? `android=new UiSelector().text("${escaped}")`
      : `android=new UiSelector().textContains("${escaped}")`;
  }
  return exact ? `-ios predicate string:label == "${text}"` : `-ios predicate string:label CONTAINS "${text}"`;
}

export function byTextField(label: string): string {
  if (driver.isAndroid) {
    return `android=new UiSelector().text("${label}")`;
  }
  return `-ios predicate string:type == "XCUIElementTypeTextField" AND label CONTAINS "${label}"`;
}

export function byHint(hint: string): string {
  const escaped = hint.replace(/"/g, '\\"');
  if (driver.isAndroid) {
    return `//android.widget.EditText[@hint="${escaped}"]`;
  }
  return `-ios predicate string:type == "XCUIElementTypeTextField" AND placeholderValue CONTAINS "${hint}"`;
}

/** Labels/content-desc do app Youse QA — fonte: mob-flutter i18n pt_BR */
export const A11y = {
  // Home
  welcomeTitle: 'Personalize seu seguro e contrate em poucos minutos',
  seguroAutoCard: 'Seguro Auto',
  seguroResidencialCard: 'Seguro Residencial',
  seguroVidaCard: 'Seguro Vida',
  btnEntrarConta: 'ENTRAR NA MINHA CONTA',
  btnCentralAjuda: 'CENTRAL DE AJUDA',

  // Cache de cotação
  cacheTitle: 'Que bom te ver de novo',
  cacheStartNew: 'Não, iniciar uma nova',

  // Lead — quotation_lead_requirements_* (hint nos EditText no device real)
  leadTitle: 'Para começar, conte um pouco sobre você',
  inputNome: 'Nome',
  inputEmail: 'E-mail',
  inputTelefone: 'Telefone',

  // Veículo — vehicle_details_*
  vehicleTitle: 'Agora, precisamos de algumas informações sobre o carro',
  inputPlaca: 'Placa ou Chassi do carro',
  switchZeroKm: 'O carro é zero km?',
  switchBlindado: 'Meu carro é blindado',
  vehicleFoundTitle: 'Legal, encontramos seu carro',

  // Endereço / uso — vehicle_additional_details_*
  addressTitle: 'Onde o carro dorme',
  addressConfirmTitle: 'Confirme o endereço',
  usageTitle: 'Como você utiliza o carro no seu dia?',
  inputCep: 'CEP',
  inputNumero: 'Número',
  inputNumeroAlt: 'Nº ou Km',
  btnSalvar: 'SALVAR',
  btnSim: 'Sim',
  btnNao: 'Não',

  // Pessoa — person_data_*
  personTitle: 'Quem será responsável pelo seguro?',
  personMaritalTitle: 'Estado civil do principal condutor',
  inputCpf: 'CPF do Segurado',
  pickerEstadoCivil: 'Estado civil',

  // Bônus — bonuses_class_*
  bonusToggleTitle: 'Você tem ou teve Seguro Auto nos últimos 12 meses?',
  bonusClassTitle: 'Selecione sua Classe de Bônus',

  // Planos — plan_selection_*
  planTitle: 'Escolha um plano ou personalize do seu jeito',
  planLoading: 'estamos montando o seu seguro',
  planErrorNetwork: 'Verifique sua conexão',
  btnQueroEsse: 'Quero esse',

  // Checkout — checkout_* / payment_*
  checkoutTitle: 'Sua cotação Youse',
  checkoutTotal: 'Total por mês',
  checkoutAssistencias: 'Assistências',
  checkoutGoPayment: 'IR PARA O PAGAMENTO',
  paymentEmailTitle: 'Confirme seu e-mail',
  paymentCreditCard: 'Cartão de crédito',
  paymentPayNow: 'Pagar agora',
  footerCompliance: 'Ao confirmar a contratação',

  // Cartão — services/credit_card
  inputCardNumber: 'Número do cartão',
  inputCardHolder: 'Nome (como está no cartão)',
  inputCardExpire: 'Validade',
  inputCardCvv: 'CVV',

  // Emissão — issuance_*
  issuanceSuccessTitle: 'Seu pagamento foi aprovado',
  issuanceProposalTitle: 'Pagamento aprovado',
  issuanceErrorTitle: 'Não conseguimos continuar a contratação neste momento',

  // Navegação comum
  btnContinuar: 'CONTINUAR',
  btnContinuarAlt: 'Continuar',
  btnVoltar: 'Voltar',
  btnOkEntendi: 'Ok, entendi',
  btnLgpdOk: 'OK, ENTENDI',
} as const;
