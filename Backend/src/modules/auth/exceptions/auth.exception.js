import { badRequest, forbidden, HttpError } from '../../../utils/httpError.js';

/**
 * Custom exceptions specifically for the Auth Module.
 * These map to existing HttpError utilities to maintain full compatibility
 * with the global error handler.
 */
export class AuthException {
  /**
   * Throws a 400 Bad Request error.
   * @param {string} message 
   */
  static badRequest(message) {
    throw badRequest(message);
  }

  /**
   * Throws a 401 Unauthorized error.
   * @param {string} message 
   */
  static unauthorized(message) {
    throw new HttpError(401, message);
  }

  /**
   * Throws a 403 Forbidden error.
   * @param {string} message 
   */
  static forbidden(message) {
    throw forbidden(message);
  }

  /**
   * Throws a 429 Too Many Requests error.
   * @param {string} message 
   */
  static tooManyRequests(message) {
    throw new HttpError(429, message);
  }
}
