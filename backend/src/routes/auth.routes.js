import { Router } from 'express';
import * as ctrl from '../controllers/auth.controller.js';
import authenticate from '../middlewares/auth.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.post(
  '/login',
  validateBody({
    identifier: { required: true, maxLength: 160 },
    password: { required: true, minLength: 4, maxLength: 100 },
  }),
  ctrl.login
);

router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);

router.put(
  '/change-password',
  authenticate,
  validateBody({
    currentPassword: { required: true },
    newPassword: { required: true, minLength: 6, maxLength: 100 },
  }),
  ctrl.changePassword
);

export default router;
