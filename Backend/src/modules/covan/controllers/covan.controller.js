// Controller layer for COVAN (Advisor) module
// Exposes functions used by routes, delegating to service layer

// Controller layer for COVAN (Advisor) module
// Exposes functions used by routes, delegating to service layer

import { covanService } from '../services/covan.service.js';

export async function advisorInfo(req, res) {
  const data = await covanService.advisorInfo(req.user);
  return data;
}

export async function myClasses(req, res) {
  const data = await covanService.myClasses(req.user);
  return data;
}

export async function classStudents(req, res) {
  const data = await covanService.classStudents(req.user, req.params.id);
  return data;
}

export async function createReplacementRequest(req, res) {
  const data = await covanService.createReplacementRequest(req.user, req.body);
  return data;
}

export async function myReplacementRequests(req, res) {
  const data = await covanService.myReplacementRequests(req.user);
  return data;
}
