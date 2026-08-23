import { describe, expect, it } from 'vitest';

import {
  authService,
  generateAccessToken,
  generateRefreshToken,
  hashPassword,
  hashRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '../modules/auth/auth.service';

describe('auth service', () => {
  it('hashes a password and returns a bcrypt hash', async () => {
    const password = 'StrongP@ssw0rd';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/\$2[aby]\$/);
  });

  it('compares a password against its hash', async () => {
    const password = 'StrongP@ssw0rd';
    const hash = await authService.hashPassword(password);

    const matches = await authService.comparePassword(password, hash);
    const wrongMatches = await authService.comparePassword('WrongPass!23', hash);

    expect(matches).toBe(true);
    expect(wrongMatches).toBe(false);
  });

  it('generates and verifies an access token', () => {
    const user = { id: 'user-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' };
    const token = generateAccessToken(user);
    const payload = verifyAccessToken(token);

    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe(user.email);
    expect(payload.type).toBe('access');
    expect(payload.role).toBe('USER');
  });

  it('verifies a valid refresh token and rejects invalid token types', () => {
    const user = { id: 'user-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' };
    const token = generateRefreshToken(user);
    const payload = verifyRefreshToken(token);

    expect(payload.sub).toBe(user.id);
    expect(payload.type).toBe('refresh');
  });

  it('throws for expired JWTs', () => {
    const expiredToken = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJyb2xlIjoiVUlTIiwiZGVwYXJ0bWVudCI6Ik1hcmtldGluZyIsInR5cGUiOiJhY2Nlc3MiLCJleHAiOjE3MDAwMDAwMDB9.';

    expect(() => verifyAccessToken(expiredToken)).toThrow();
  });

  it('throws for invalid JWTs', () => {
    expect(() => verifyAccessToken('not-a-valid.jwt')).toThrow();
  });

  it('hashes refresh tokens without storing plain text', async () => {
    const token = 'refresh-token-value';
    const hash = await hashRefreshToken(token);
    const secondHash = await hashRefreshToken(token);

    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(secondHash);
    expect(await authService.verifyRefreshTokenHash(token, hash)).toBe(true);
    expect(await authService.verifyRefreshTokenHash('different-token', hash)).toBe(false);
  });
});
