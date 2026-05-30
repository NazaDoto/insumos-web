import { Router } from 'express';
import authenticate from '../middlewares/auth.js';

import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import categoriesRoutes from './categories.routes.js';
import branchesRoutes from './branches.routes.js';
import itemsRoutes from './items.routes.js';
import stockRoutes from './stock.routes.js';
import { providersRouter, providerSelfRouter } from './providers.routes.js';
import ordersRoutes from './orders.routes.js';
import usageRoutes from './usage.routes.js';
import customFieldsRoutes from './customFields.routes.js';
import logsRoutes from './logs.routes.js';
import reportsRoutes from './reports.routes.js';
import dashboardRoutes from './dashboard.routes.js';

const router = Router();

// Publicas
router.use('/auth', authRoutes);

// Protegidas (requieren JWT)
router.use(authenticate);

router.use('/dashboard', dashboardRoutes);
router.use('/users', usersRoutes);
router.use('/categories', categoriesRoutes);
router.use('/branches', branchesRoutes);
router.use('/items', itemsRoutes);
router.use('/stock', stockRoutes);
router.use('/providers', providersRouter);
router.use('/provider', providerSelfRouter);
router.use('/orders', ordersRoutes);
router.use('/usage', usageRoutes);
router.use('/custom-fields', customFieldsRoutes);
router.use('/logs', logsRoutes);
router.use('/reports', reportsRoutes);

export default router;
