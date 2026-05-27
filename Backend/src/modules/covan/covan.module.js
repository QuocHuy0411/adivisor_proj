// covan.module.js
// Bootstrap for the COVAN (advisor) module, wiring repository, service, and controller.

import { covanRepository } from './repositories/covan.repository.js';
import { CovanService } from './services/covan.service.js';
import * as covanController from './controllers/covan.controller.js';

// Instantiate service (no dependencies beyond repository)
const covanService = new CovanService();

// Export singletons for use in routes and elsewhere
export { covanRepository, covanService, covanController };
