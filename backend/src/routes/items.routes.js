import { Router } from 'express';
import * as ctrl from '../controllers/items.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';
import { uploadExcel } from '../middlewares/upload.js';

const router = Router();
const canWrite = authorize(ROLES.SYSADMIN, ROLES.ADMIN, ROLES.PROVIDER);

router.get('/', ctrl.list);

router.get('/import/template', canWrite, ctrl.downloadImportTemplate);
router.post('/import', canWrite, (req, res, next) => {
  uploadExcel(req, res, (err) => (err ? next(err) : next()));
}, ctrl.importExcel);

router.get('/:id', ctrl.getOne);
router.get('/:id/movements', ctrl.movements);
router.get('/:id/attributes', ctrl.attributes);

router.post(
  '/',
  canWrite,
  validateBody({
    name: { required: true, maxLength: 160 },
    unit: { maxLength: 40 },
    minimumStock: { type: 'number', min: 0 },
  }),
  ctrl.create
);
router.put('/:id', canWrite, ctrl.update);
router.delete('/:id', canWrite, ctrl.remove);

export default router;
