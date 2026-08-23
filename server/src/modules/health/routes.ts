import { Router } from 'express';
import prisma from '../../infrastructure/database/prisma';
import { metrics } from '../../infrastructure/observability/observability';

export const createHealthRouter = () => {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'skillswap-server',
      timestamp: new Date().toISOString(),
    });
  });

  router.get('/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ status: 'ready', service: 'skillswap-server' });
    } catch (_error) {
      metrics.databaseError('readiness');
      return res.status(503).json({ status: 'not_ready', service: 'skillswap-server' });
    }
  });

  router.get('/metrics', (_req, res) => {
    res.type('text/plain').status(200).send(metrics.prometheus());
  });

  return router;
};
