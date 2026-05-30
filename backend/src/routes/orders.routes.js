import { Router } from 'express';
import * as ctrl from '../controllers/orders.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/history', ctrl.history);

router.post(
  '/',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN),
  validateBody({ providerId: { required: true, type: 'integer' } }),
  ctrl.create
);

router.patch(
  '/:id/status',
  authorize(ROLES.SYSADMIN, ROLES.PROVIDER),
  validateBody({ status: { required: true } }),
  ctrl.updateStatus
);

router.patch('/:id/cancel', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.cancel);

export default router;
