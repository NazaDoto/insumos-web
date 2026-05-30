import { Router } from 'express';
import * as ctrl from '../controllers/stock.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

const router = Router();

router.get('/', ctrl.list);
router.get('/movements', ctrl.movements);

const moveRoles = authorize(ROLES.SYSADMIN, ROLES.ADMIN);

router.post('/income', moveRoles, validateBody({
  itemId: { required: true, type: 'integer' },
  branchId: { required: true, type: 'integer' },
  quantity: { required: true, type: 'number', min: 0.001 },
}), ctrl.income);

router.post('/outcome', moveRoles, validateBody({
  itemId: { required: true, type: 'integer' },
  branchId: { required: true, type: 'integer' },
  quantity: { required: true, type: 'number', min: 0.001 },
}), ctrl.outcome);

router.post('/transfer', moveRoles, validateBody({
  itemId: { required: true, type: 'integer' },
  originBranchId: { required: true, type: 'integer' },
  destinationBranchId: { required: true, type: 'integer' },
  quantity: { required: true, type: 'number', min: 0.001 },
}), ctrl.transfer);

router.post('/adjustment', moveRoles, validateBody({
  itemId: { required: true, type: 'integer' },
  branchId: { required: true, type: 'integer' },
  newQuantity: { required: true, type: 'number', min: 0 },
}), ctrl.adjustment);

export default router;
