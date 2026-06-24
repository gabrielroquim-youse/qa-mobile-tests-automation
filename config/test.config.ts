/**
 * Configuração centralizada de testes mobile.
 *
 * Variáveis sensíveis (tokens, credenciais) devem vir do .env.
 * Valores hardcoded são fallback para execução local em QA.
 */
export default {
  env: process.env.ENV || 'qa',
  platform: (process.env.PLATFORM || 'android') as 'android' | 'ios' | 'both',

  android: {
    appPath: process.env.ANDROID_APP_PATH || './apps/youse-qa.apk',
    appPackage: process.env.ANDROID_APP_PACKAGE || 'io.youse.app',
    appActivity: process.env.ANDROID_APP_ACTIVITY || '.MainActivity',
    deviceName: process.env.ANDROID_DEVICE_NAME || 'Android Emulator',
    platformVersion: process.env.ANDROID_PLATFORM_VERSION || '14',
    /** Serial do device (adb devices) — obrigatório com mais de um aparelho conectado */
    udid: process.env.ANDROID_UDID || '',
    /** true = app já instalado no device (sem APK local) */
    useInstalledApp: process.env.ANDROID_USE_INSTALLED_APP === 'true',
    /** pin | password | pattern — desbloqueio automático (opcional, ver ANDROID_UNLOCK_KEY) */
    unlockType: process.env.ANDROID_UNLOCK_TYPE || '',
    unlockKey: process.env.ANDROID_UNLOCK_KEY || '',
    /** adb stay-awake antes/depois da sessão (padrão: true) */
    keepAwake: process.env.ANDROID_KEEP_AWAKE !== 'false',
  },

  ios: {
    appPath: process.env.IOS_APP_PATH || './apps/youse-qa.app',
    bundleId: process.env.IOS_BUNDLE_ID || 'io.youse.app',
    deviceName: process.env.IOS_DEVICE_NAME || 'iPhone 15',
    platformVersion: process.env.IOS_PLATFORM_VERSION || '17.0',
    udid: process.env.IOS_UDID || '',
  },

  appium: {
    host: process.env.APPIUM_HOST || '127.0.0.1',
    port: parseInt(process.env.APPIUM_PORT || '4723', 10),
  },

  credentials: {
    name: process.env.TEST_NAME || 'John Youser',
    documentNumber: process.env.TEST_DOCUMENT_NUMBER || '123.456.761-08',
    email: process.env.TEST_EMAIL || `automation+${Date.now()}@youse.com.br`,
    phone: process.env.TEST_USER_TEL || '(11) 91234-5678',
    licensePlate: process.env.TEST_LICENSE_PLATE || 'YOU-0020',
    creditCard: {
      number: process.env.TEST_CARD_NUMBER || '4111 1111 1111 1111',
      expireDate: process.env.TEST_CARD_EXPIRE || '0330',
      cvv: process.env.TEST_CARD_CVV || '737',
    },
  },

  timeouts: {
    default: parseInt(process.env.TIMEOUT || '60000', 10),
    implicit: parseInt(process.env.IMPLICIT_WAIT || '10000', 10),
    short: 5000,
    long: 20000,
  },
};
