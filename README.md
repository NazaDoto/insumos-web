# Sistema de Gestion de Insumos

Aplicacion web full-stack para la gestion integral de insumos: usuarios, proveedores, stock por oficinas/sucursales, pedidos a proveedores, uso de insumos por empleados, atributos personalizados, auditoria (logs), reportes y dashboards diferenciados por rol.

## Stack

- **Frontend:** Vue 3 (Options API) + Vue Router + Pinia + Axios + Vite
- **Backend:** Node.js + Express (API REST por capas)
- **Base de datos:** MySQL 8 (InnoDB, transacciones)
- **Auth:** JWT + bcrypt

## Estructura del repositorio

```
insumos-web/
├── backend/                 # API REST (Express + MySQL)
│   ├── src/
│   │   ├── config/          # env y pool de conexiones
│   │   ├── controllers/     # logica de cada modulo
│   │   ├── services/        # logica de negocio (stock atomico)
│   │   ├── middlewares/     # auth, authorize, validate, errores
│   │   ├── routes/          # definicion de endpoints
│   │   ├── utils/           # jwt, password, audit, paginacion
│   │   └── db/              # schema.sql, init.js, seed.js
│   └── .env                 # configuracion (credenciales)
├── insumos-web/             # Frontend Vue (lo que sirve nginx desde dist/)
│   └── src/
│       ├── views/           # vistas por modulo
│       ├── components/ui/   # componentes reutilizables
│       ├── layouts/         # AppLayout (sidebar + topbar)
│       ├── stores/          # Pinia (auth, ui/toasts)
│       ├── services/api.js  # instancia Axios
│       └── router/          # rutas + guards por rol
└── deploy/                  # nginx, PM2
```

## Roles

| Rol | Descripcion |
|-----|-------------|
| `sysadmin` | Administrador del sistema. Acceso total. |
| `admin` | Gestiona sus insumos, oficinas, empleados y pedidos. |
| `provider` | Gestiona su catalogo/stock y responde pedidos. |
| `employee` | Registra uso de insumos en sus oficinas asignadas. |

## Puesta en marcha (desarrollo)

### 1. Base de datos

Requiere MySQL en ejecucion. Ajusta credenciales en `backend/.env`:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Nazacapo341746$
DB_NAME=insumos_db
```

### 2. Backend

```bash
cd backend
npm install
npm run db:init     # crea la base de datos + tablas
npm run db:migrate  # migraciones en bases ya existentes (ej. id externo para Excel)
npm run db:seed     # usuarios y categorias de ejemplo
  npm run dev         # API en http://localhost:3506
```

Usuarios de ejemplo creados por el seed:

| Rol | Usuario | Contrasena |
|-----|---------|------------|
| sysadmin | `admin` | `Admin1234!` |
| admin | `admin1` | `Admin1234!` |
| empleado | `empleado1` | `Empleado1234!` |
| proveedor | `proveedor1` | `Proveedor1234!` |

> Cambia estas contrasenas en produccion.

### 3. Frontend

```bash
cd insumos-web
npm install
  npm run dev         # http://localhost:5173 (proxy /api -> :3506)
```

## Despliegue (produccion)

### Backend

```bash
cd backend
npm ci --omit=dev
npm run db:init && npm run db:seed   # solo la primera vez
# Con PM2:
pm2 start ../deploy/ecosystem.config.cjs && pm2 save
```

### Frontend

```bash
cd insumos-web
npm ci
npm run build       # genera dist/
```

### Nginx

Usa `deploy/nginx-insumos.conf`. Importante: agrega el bloque `location /api/`
que hace **proxy** al backend (el archivo original solo servia los estaticos).

```bash
sudo cp deploy/nginx-insumos.conf /etc/nginx/sites-available/insumos.nazadoto.com
sudo ln -s /etc/nginx/sites-available/insumos.nazadoto.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Certbot (certificado SSL)

```bash
sudo certbot --nginx -d insumos.nazadoto.com
```

Certbot edita el bloque del puerto 443 agregando `ssl_certificate` y la redireccion.
Renovacion automatica:

```bash
sudo certbot renew --dry-run
```

## Seguridad implementada

- Contrasenas con bcrypt. Tokens JWT con expiracion.
- Autorizacion por rol y por propiedad del recurso en el **backend** (no solo en el front).
- Consultas preparadas (mysql2) contra inyeccion SQL.
- CORS configurable, manejo centralizado de errores y de sesion expirada.
- Auditoria: cada accion critica genera un log inmutable para usuarios comunes.
- Movimientos de stock atomicos mediante transacciones MySQL.

## Modulos / API principal

`/api/auth`, `/api/users`, `/api/items`, `/api/categories`, `/api/branches`,
`/api/stock` (+ `income`/`outcome`/`transfer`/`adjustment`/`movements`),
`/api/providers`, `/api/provider/items`, `/api/orders`, `/api/usage`,
`/api/custom-fields`, `/api/logs`, `/api/reports` (+ `export/excel`), `/api/dashboard`.

### Importación de insumos (Excel)

- Pantalla **Insumos** → **Importar Excel** (plantilla descargable desde el modal).
- Columna **id_externo**: identificador del Excel/sistema origen; al reimportar se **actualiza** el mismo insumo.
- Con **stock** se registra ingreso (o ajuste si ya existía). **Sucursal** es opcional: vacía + una sola oficina → esa oficina; vacía + varias → stock general sin sucursal.
- Endpoint: `POST /api/items/import` (multipart, campo `file`), plantilla: `GET /api/items/import/template`.
