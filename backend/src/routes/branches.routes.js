import { Router } from 'express';
import * as ctrl from '../controllers/branches.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', ctrl.list); // todos los roles autenticados (scoped)
router.get('/:id', ctrl.getOne);
router.get('/:id/stock', ctrl.branchStock);

router.post('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), validateBody({ name: { required: true, maxLength: 120 } }), ctrl.create);
router.put('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.update);
router.delete('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.remove);

router.post('/:id/employees', authorize(ROLES.SYSADMIN, ROLES.ADMIN), validateBody({ userId: { required: true, type: 'integer' } }), ctrl.assignEmployee);
router.delete('/:id/employees/:userId', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.unassignEmployee);

export default router;
