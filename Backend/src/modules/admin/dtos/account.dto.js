import { AdminValidator } from '../validators/admin.validator.js';

/**
 * Data Transfer Object for validating and cleaning account update inputs.
 */
export class UpdateAccountDto {
  /**
   * @param {Object} rawData 
   */
  constructor(rawData) {
    const { ho_va_ten, email } = AdminValidator.validateEmployeePayload(rawData);
    this.ho_va_ten = ho_va_ten;
    this.email = email;
  }
}
