import { Router } from 'express';
import * as ctrl from '../controllers/items.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.get('/:id/movements', ctrl.movements);
router.get('/:id/attributes', ctrl.attributes);

router.post(
  '/',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER),
  validateBody({
    name: { required: true, maxLength: 160 },
    unit: { maxLength: 40 },
    minimumStock: { type: 'number', min: 0 },
  }),
  ctrl.create
);
router.put('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER), ctrl.update);
router.delete('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER), ctrl.remove);

export default router;
