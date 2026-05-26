import { badRequest, forbidden, notFound } from '../../../utils/httpError.js';

/**
 * Custom exceptions specifically for the Admin Module.
 * These map to existing HttpError utilities to maintain full compatibility
 * with the global error handler.
 */
export class AdminException {
  /**
   * Throws a 400 Bad Request error.
   * @param {string} message 
   */
  static badRequest(message) {
    throw badRequest(message);
  }

  /**
   * Throws a 403 Forbidden error.
   * @param {string} message 
   */
  static forbidden(message) {
    throw forbidden(message);
  }

  /**
   * Throws a 404 Not Found error.
   * @param {string} message 
   */
  static notFound(message) {
    throw notFound(message);
  }
}
