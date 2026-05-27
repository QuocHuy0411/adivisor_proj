// DTO for replacement request payload
// Defines the expected shape of the request body for creating a replacement request.
export class ReplacementRequestDto {
  /**
   * @param {Object} data
   * @param {string} data.ma_lop - Class ID for which replacement is requested
   * @param {string} data.ly_do - Reason for replacement
   */
  constructor({ ma_lop, ly_do }) {
    this.ma_lop = ma_lop;
    this.ly_do = ly_do;
  }
}
