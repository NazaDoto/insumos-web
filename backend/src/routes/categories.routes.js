import { Router } from 'express';
import * as ctrl from '../controllers/categories.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.list);
router.post('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), validateBody({ name: { required: true, maxLength: 120 } }), ctrl.create);
router.put('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.update);
router.delete('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.remove);

export default router;
