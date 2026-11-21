import express from 'express';
import cors from 'cors';
import { createRoutes } from './routes.js';
import { createCache } from './cache.js';

export function createMemoryStore() {
  let latest = null;
  return {
    getLatest: () => latest,
    setLatest: (data) => {
      latest = data;
    },
    clear: () => {
      latest = null;
    }
  };
}

export function createApp({
  cache = createCache(),
  store = createMemoryStore(),
  runAnalysisFn,
  generateReplyFn,
  generateInsightsFn
} = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const apiRouter = createRoutes({
    cache,
    store,
    runAnalysisFn,
    generateReplyFn,
    generateInsightsFn
  });

  app.use('/api', apiRouter);

  // 404 handler for unknown routes
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error middleware
  app.use((err, req, res, next) => {
    if (err.status === 429 || (typeof err.status === 'number' && err.status >= 500)) {
      return res.status(502).json({ error: 'AI service unavailable, please try again' });
    }

    const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large (max 1 MB)'
        : err.message || 'Internal server error';
    res.status(status).json({ error: message });
  });

  return app;
}
