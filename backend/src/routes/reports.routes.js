import { Router } from 'express';
import * as ctrl from '../controllers/reports.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';

const router = Router();

const reportRoles = authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER);

router.get('/stock', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.stock);
router.get('/low-stock', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.lowStock);
router.get('/orders', reportRoles, ctrl.orders);
router.get('/usage', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.EMPLOYEE), ctrl.usage);
router.get('/movements', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.movements);
router.get('/export/excel', reportRoles, ctrl.exportExcel);

export default router;
