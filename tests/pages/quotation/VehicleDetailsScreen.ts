/**
 * Etapa 2 — Dados do veículo (mobile).
 */
import { A11y } from '../../helpers/selectors';
import QuotationScreenLayout from './QuotationScreenLayout';

export class VehicleDetailsScreen extends QuotationScreenLayout {
  async waitForLoaded(): Promise<void> {
    const loaded =
      (await this.hasText(A11y.vehicleTitle, 30_000)) ||
      (await this.hasText(A11y.inputPlaca, 30_000)) ||
      (await this.hasText(A11y.vehicleFoundTitle, 30_000));
    if (!loaded) throw new Error('Tela de veículo não carregou');
  }

  async fillLicensePlate(plate = 'YOU-0020'): Promise<VehicleDetailsScreen> {
    await this.typeByLabel(A11y.inputPlaca, plate.replace('-', ''));
    return this;
  }

  async selectBrandNew(brandNew = false): Promise<VehicleDetailsScreen> {
    await this.setSwitchByLabel(A11y.switchZeroKm, brandNew);
    if (brandNew && (await this.hasText(A11y.btnOkEntendi, 4_000))) {
      await this.tapByLabel(A11y.btnOkEntendi);
    }
    return this;
  }

  async selectBulletproof(bulletproof = false): Promise<VehicleDetailsScreen> {
    await this.setSwitchByLabel(A11y.switchBlindado, bulletproof);
    return this;
  }
}

export default VehicleDetailsScreen;
