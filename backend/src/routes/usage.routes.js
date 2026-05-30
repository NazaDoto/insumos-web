import { Router } from 'express';
import * as ctrl from '../controllers/usage.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.EMPLOYEE), ctrl.list);
router.get('/my-history', authorize(ROLES.EMPLOYEE), ctrl.myHistory);
router.get('/:id', ctrl.getOne);

router.post(
  '/',
  authorize(ROLES.EMPLOYEE, ROLES.ADMIN),
  validateBody({
    itemId: { required: true, type: 'integer' },
    branchId: { required: true, type: 'integer' },
    quantity: { required: true, type: 'number', min: 0.001 },
  }),
  ctrl.create
);

export default router;
