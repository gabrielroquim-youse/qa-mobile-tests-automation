/**
 * Gera massa de dados dinâmica para testes mobile.
 * Espelha a estratégia do projeto E2E (qa-e2e-tests-automation).
 */
import { faker } from '@faker-js/faker/locale/pt_BR';
import TestConfig from '../../config/test.config';

export interface MobileTestData {
  name: string;
  email: string;
  phone: string;
  documentNumber: string;
  licensePlate: string;
}

export function generateMobileTestData(overrides?: Partial<MobileTestData>): MobileTestData {
  const dddsValidos = [11, 21, 31, 41, 51, 61, 71, 81, 91];
  const ddd = faker.helpers.arrayElement(dddsValidos);

  const rawName = faker.person.fullName();
  const normalizedName = rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z\s]/g, '')
    .trim();

  return {
    name: normalizedName,
    email: `qa.mobile+${Date.now()}@youse.com.br`,
    phone: `(${ddd}) 9${faker.number.int({ min: 1000, max: 9999 })}-${faker.number.int({ min: 1000, max: 9999 })}`,
    documentNumber: TestConfig.credentials.documentNumber,
    licensePlate: TestConfig.credentials.licensePlate,
    ...overrides,
  };
}
