import { Router } from 'express';
import * as ctrl from '../controllers/users.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

const ROLE_VALUES = Object.values(ROLES);

router.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.list);
router.get('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.getOne);

router.post(
  '/',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN),
  validateBody({
    firstName: { required: true, maxLength: 80 },
    lastName: { required: true, maxLength: 80 },
    email: { required: true, email: true, maxLength: 160 },
    username: { required: true, minLength: 3, maxLength: 80 },
    password: { required: true, minLength: 6, maxLength: 100 },
    role: { required: true, enum: ROLE_VALUES },
  }),
  ctrl.create
);

router.put(
  '/:id',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN),
  validateBody({
    email: { email: true, maxLength: 160 },
    role: { enum: ROLE_VALUES },
  }),
  ctrl.update
);

router.patch(
  '/:id/status',
  authorize(ROLES.SYSADMIN, ROLES.ADMIN),
  validateBody({ status: { required: true, enum: ['active', 'inactive'] } }),
  ctrl.setStatus
);

router.delete('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.remove);

export default router;
