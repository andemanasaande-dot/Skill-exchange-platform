import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import prisma from '../infrastructure/database/prisma';
import { metrics, requestContext, trackError, configureErrorTracker } from '../infrastructure/observability/observability';
import { createHealthRouter } from '../modules/health/routes';

describe('observability', () => {
  afterEach(() => vi.restoreAllMocks());

  it('propagates request and correlation IDs and records latency metrics', async () => {
    const app = express();
    app.use(requestContext.middleware);
    app.get('/test', (_req, res) => res.status(204).send());

    const response = await request(app).get('/test').set('x-request-id', 'request-123').set('x-correlation-id', 'correlation-456');

    expect(response.status).toBe(204);
    expect(response.headers['x-request-id']).toBe('request-123');
    expect(response.headers['x-correlation-id']).toBe('correlation-456');
    metrics.request('GET', '/test', 204, 3);
    expect(metrics.prometheus()).toContain('http_requests_total');
  });

  it('reports database readiness without exposing database errors', async () => {
    const app = express();
    app.use('/api/v1', createHealthRouter());
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('database details must stay private'));

    const response = await request(app).get('/api/v1/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', service: 'skillswap-server' });
    expect(JSON.stringify(response.body)).not.toContain('database details');
  });

  it('sends captured errors to an optional tracker without requiring one', () => {
    const capture = vi.fn();
    configureErrorTracker({ captureException: capture });

    trackError(new Error('expected failure'), { password: 'secret', requestId: 'request-123' });

    expect(capture).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ password: '[REDACTED]', requestId: 'request-123' }));
  });
});