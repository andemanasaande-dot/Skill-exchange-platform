import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../app';

describe('production security headers', () => {
  it('sets Helmet headers and disables Express fingerprinting', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });
});
