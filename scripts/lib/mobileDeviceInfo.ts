import { execSync } from 'node:child_process';

const NETWORK_TYPE_LABEL: Record<number, string> = {
  0: 'Desconhecida',
  1: 'GPRS',
  2: 'EDGE',
  3: 'UMTS',
  4: 'CDMA',
  5: 'EVDO',
  13: 'LTE (4G)',
  14: 'eHRPD',
  15: 'HSPA+',
  20: 'NR (5G)',
};

export interface MobileDeviceInfo {
  collectedAt: string;
  udid: string | null;
  model: string | null;
  manufacturer: string | null;
  deviceName: string | null;
  androidVersion: string | null;
  sdkVersion: string | null;
  networkType: string;
  networkTransport: string;
  wifiSsid: string | null;
  carrier: string | null;
  appPackage: string | null;
  appInstalled: boolean;
}

function adb(serial: string | undefined, cmd: string): string {
  try {
    const prefix = serial ? `adb -s ${serial} ` : 'adb ';
    return execSync(`${prefix}${cmd}`, { encoding: 'utf8', timeout: 15_000 }).trim();
  } catch {
    return '';
  }
}

function shellProp(serial: string | undefined, prop: string): string | null {
  const value = adb(serial, `shell getprop ${prop}`);
  return value || null;
}

function parseDataNetworkType(dumpsys: string): string | null {
  const match = dumpsys.match(/mDataNetworkType=(\d+)/);
  if (!match) return null;
  const code = parseInt(match[1], 10);
  return NETWORK_TYPE_LABEL[code] ?? `Tipo ${code}`;
}

function parseWifi(dumpsysWifi: string): { connected: boolean; ssid: string | null } {
  const ssidMatch = dumpsysWifi.match(/SSID: "([^"]+)"/) ?? dumpsysWifi.match(/mWifiInfo SSID: ([^\s,]+)/);
  const ssid = ssidMatch?.[1]?.replace(/"/g, '') ?? null;
  const connected = /mNetworkInfo.*state: CONNECTED/i.test(dumpsysWifi) || Boolean(ssid && ssid !== '<unknown ssid>');
  return { connected, ssid };
}

export function collectMobileDeviceInfo(options: { udid?: string; appPackage?: string }): MobileDeviceInfo {
  const serial = options.udid?.trim() || undefined;
  const telephony = adb(serial, 'shell dumpsys telephony.registry');
  const wifiDump = adb(serial, 'shell dumpsys wifi');
  const connectivity = adb(serial, 'shell dumpsys connectivity');
  const dataNetwork = parseDataNetworkType(telephony);
  const wifi = parseWifi(wifiDump);

  let networkTransport = 'Desconhecida';
  if (wifi.connected) networkTransport = 'Wi-Fi';
  else if (/TRANSPORT_CELLULAR/i.test(connectivity)) networkTransport = 'Dados móveis';
  else if (/TRANSPORT_WIFI/i.test(connectivity)) networkTransport = 'Wi-Fi';

  const appPackage = options.appPackage ?? null;
  let appInstalled = false;
  if (appPackage) {
    const packages = adb(serial, `shell pm list packages ${appPackage}`);
    appInstalled = packages.includes(appPackage);
  }

  return {
    collectedAt: new Date().toISOString(),
    udid: serial ?? null,
    model: shellProp(serial, 'ro.product.model'),
    manufacturer: shellProp(serial, 'ro.product.manufacturer'),
    deviceName: shellProp(serial, 'ro.product.device'),
    androidVersion: shellProp(serial, 'ro.build.version.release'),
    sdkVersion: shellProp(serial, 'ro.build.version.sdk'),
    networkType: dataNetwork ?? (wifi.connected ? 'Wi-Fi' : '—'),
    networkTransport,
    wifiSsid: wifi.ssid,
    carrier: shellProp(serial, 'gsm.operator.alpha'),
    appPackage,
    appInstalled,
  };
}

export function formatDeviceLabel(info: MobileDeviceInfo): string {
  const brand = info.manufacturer ?? 'Android';
  const model = info.model ?? info.deviceName ?? 'Device';
  return `${brand} ${model}`.replace(/\b\w/g, (c) => c.toUpperCase());
}
