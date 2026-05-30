import { Router } from 'express';
import * as ctrl from '../controllers/customFields.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

const MODULES = ['items', 'usage', 'branches', 'orders', 'movements'];
const TYPES = ['text', 'textarea', 'number', 'date', 'boolean', 'select', 'file'];

router.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.list);
router.get('/module/:module', ctrl.byModule);

router.post(
  '/',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN),
  validateBody({
    module: { required: true, enum: MODULES },
    fieldName: { required: true, maxLength: 80 },
    fieldLabel: { required: true, maxLength: 120 },
    fieldType: { required: true, enum: TYPES },
  }),
  ctrl.create
);
router.put('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.update);
router.delete('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.remove);

export default router;
