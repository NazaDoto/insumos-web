import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import env from './config/env.js';
import router from './routes/index.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(
  cors({
    origin(origin, cb) {
      // Permite herramientas sin origin (curl/postman) y los origenes configurados.
      if (!origin || env.corsOrigin.includes(origin)) return cb(null, true);
      return cb(new Error('Origen no permitido por CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

app.use('/api', router);

app.use(notFound);
app.use(errorHandler);

export default app;
