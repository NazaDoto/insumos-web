import { Router } from 'express';
import * as ctrl from '../controllers/export.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';

const router = Router();

router.get('/users', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.users);
router.get('/items', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.items);
router.get('/categories', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER), ctrl.categories);
router.get('/branches', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.EMPLOYEE), ctrl.branches);
router.get('/stock', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.EMPLOYEE), ctrl.stock);
router.get('/movements', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.movements);
router.get('/orders', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER), ctrl.orders);
router.get('/usage', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.EMPLOYEE), ctrl.usage);
router.get('/logs', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.logs);
router.get('/providers', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.providers);
router.get('/provider-catalog', authorize(ROLES.PROVIDER), ctrl.providerCatalog);
router.get('/custom-fields', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.customFields);

export default router;
