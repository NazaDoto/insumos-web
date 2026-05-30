// PM2 - gestiona el backend en produccion.
// Uso:  pm2 start deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'insumos-api',
      cwd: '/var/www/nazadoto/portfolio/insumos-web/backend',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3506,
      },
    },
  ],
}
