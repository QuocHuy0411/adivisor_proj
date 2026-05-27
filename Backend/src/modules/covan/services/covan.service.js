// Service layer for COVAN (advisor) module
// Provides business logic using the repository layer

import { covanRepository } from '../repositories/covan.repository.js';

export class CovanService {
  async myClasses(user) {
    return covanRepository.myClasses(user.ma_co_van);
  }

  async classStudents(user, ma_lop) {
    return covanRepository.classStudents(user.ma_co_van, ma_lop);
  }

  async createReplacementRequest(user, payload) {
    return covanRepository.createReplacementRequest(user, payload);
  }

  async myReplacementRequests(user) {
    return covanRepository.myReplacementRequests(user.ma_co_van);
  }

  async advisorInfo(user) {
    return covanRepository.advisorInfo(user.ma_co_van);
  }
}

export const covanService = new CovanService();
