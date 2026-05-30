import { Router } from 'express';
import * as ctrl from '../controllers/logs.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';

const router = Router();

router.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.list);
router.get('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.getOne);

export default router;
