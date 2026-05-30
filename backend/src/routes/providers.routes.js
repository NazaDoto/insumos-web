import { Router } from 'express';
import * as ctrl from '../controllers/providers.controller.js';
import { authorize, ROLES } from '../middlewares/authorize.js';
import { validateBody } from '../middlewares/validate.js';

// Rutas de consulta de proveedores (para administradores y sysadmin).
export const providersRouter = Router();
providersRouter.get('/', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.listProviders);
providersRouter.get('/:id', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.getProvider);
providersRouter.get('/:id/items', authorize(ROLES.SYSADMIN, ROLES.ADMIN), ctrl.providerItems);

// Rutas de gestion del propio catalogo del proveedor.
export const providerSelfRouter = Router();
providerSelfRouter.get('/items', authorize(ROLES.PROVIDER), ctrl.myItems);
providerSelfRouter.post(
  '/items',
  authorize(ROLES.PROVIDER),
  validateBody({ name: { required: true, maxLength: 160 }, quantity: { type: 'number', min: 0 } }),
  ctrl.createItem
);
providerSelfRouter.put('/items/:id', authorize(ROLES.PROVIDER), ctrl.updateItem);
providerSelfRouter.delete('/items/:id', authorize(ROLES.PROVIDER), ctrl.deleteItem);
