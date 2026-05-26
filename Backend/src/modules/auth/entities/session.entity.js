/**
 * Represents a formatted Session entity.
 */
export class SessionEntity {
  /**
   * @param {Object} data 
   * @param {string} data.accessToken
   * @param {string} data.refreshToken
   * @param {Object} data.user
   */
  constructor({ accessToken, refreshToken, user }) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.user = user;
  }

  toJSON() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      user: this.user
    };
  }
}
