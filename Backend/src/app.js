import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import ctsvRoutes from './modules/ctsv/ctsv.routes.js';
import khoaRoutes from './modules/khoa/khoa.routes.js';
import covanRoutes from './modules/covan/covan.routes.js';
import sinhvienRoutes from './modules/sinhvien/sinhvien.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'adivisor-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/ctsv', ctsvRoutes);
app.use('/api/khoa', khoaRoutes);
app.use('/api/covan', covanRoutes);
app.use('/api/sinhvien', sinhvienRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint không tồn tại' });
});

app.use(errorHandler);
