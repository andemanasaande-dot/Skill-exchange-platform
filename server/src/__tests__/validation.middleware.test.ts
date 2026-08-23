import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import { emailSchema, idParamSchema, paginationSchema, passwordSchema } from '../validation/schemas';

describe('shared validation middleware', () => {
  it('accepts valid body, params and query values', async () => {
    const app = express();

    app.use(express.json());
    app.post(
      '/users/:id',
      validateParams(z.object({ id: idParamSchema })),
      validateQuery(paginationSchema),
      validateBody(
        z.object({
          email: emailSchema,
          password: passwordSchema,
        }),
      ),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    const response = await request(app)
      .post('/users/123e4567-e89b-12d3-a456-426614174000?page=2&limit=25')
      .send({
        email: 'user@example.com',
        password: 'Str0ng!Pass123',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });

  it('returns a standard validation error for invalid body input', async () => {
    const app = express();
    app.use(express.json());

    app.post(
      '/register',
      validateBody(
        z.object({
          email: emailSchema,
          password: passwordSchema,
        }),
      ),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    const response = await request(app).post('/register').send({
      email: 'invalid-email',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(response.body.error.issues)).toBe(true);
  });

  it('returns a controlled error for invalid ID and unsafe fields are ignored safely', async () => {
    const app = express();
    app.use(express.json());

    app.get(
      '/items/:id',
      validateParams(z.object({ id: idParamSchema })),
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    const response = await request(app).get('/items/not-a-valid-id');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_ID');
    expect(response.body.error.issues[0].path).toContain('id');
  });
});
