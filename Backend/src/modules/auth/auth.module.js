import { AuthRepository } from './repositories/auth.repository.js';
import { SessionRepository } from './repositories/session.repository.js';
import { AuthService } from './services/auth.service.js';
import { SessionService } from './services/session.service.js';
import { OtpService } from './services/otp.service.js';
import { AuthController } from './controllers/auth.controller.js';

// 1. Instantiate Repositories
const authRepository = new AuthRepository();
const sessionRepository = new SessionRepository();

// 2. Instantiate Services (with Dependency Injection)
const sessionService = new SessionService({ sessionRepository, authRepository });
const authService = new AuthService({ authRepository, sessionService });
const otpService = new OtpService({ authRepository });

// 3. Instantiate Controller
const authController = new AuthController({
  authService,
  sessionService,
  otpService
});

// Export all instantiated singletons for ease of usage
export {
  authRepository,
  sessionRepository,
  sessionService,
  authService,
  otpService,
  authController
};
