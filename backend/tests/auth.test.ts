import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { hashPassword } from '../src/utils/password';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import jwt from 'jsonwebtoken';

describe('Auth Endpoints & Tokens (Phase 1)', () => {
  let fixture: TestTenantFixture;
  const testUserPassword = 'ValidPassword123!';
  const suffix = `auth_${Date.now()}`;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(suffix);

    // Create a dedicated user for login tests
    const passwordHash = await hashPassword(testUserPassword);
    await prisma.user.create({
      data: {
        companyId: fixture.company.id,
        email: `login.test.${suffix}@test.com`,
        passwordHash,
        role: 'employee',
        departmentId: fixture.departmentA.id,
        mustChangePassword: false,
      },
    });
  });

  afterAll(async () => {
    await cleanupTestTenant(fixture.company.id);
  });

  describe('POST /auth/login', () => {
    it('rejects invalid credentials with 401 and generic error message without leaking email existence', async () => {
      // 1. Non-existent email
      const nonExistentRes = await request(app)
        .post('/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'wrongpassword' });

      expect(nonExistentRes.status).toBe(401);
      expect(nonExistentRes.body.error).toBeDefined();
      expect(nonExistentRes.body.error.message).toBe('Invalid credentials');
      expect(nonExistentRes.body.error.code).toBe('INVALID_CREDENTIALS');

      // 2. Existing email with wrong password
      const wrongPasswordRes = await request(app)
        .post('/auth/login')
        .send({ email: `login.test.${suffix}@test.com`, password: 'IncorrectPassword999!' });

      expect(wrongPasswordRes.status).toBe(401);
      expect(wrongPasswordRes.body.error.message).toBe('Invalid credentials');
      expect(wrongPasswordRes.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects malformed request body with 400 validation error', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns access token (15m) and refresh token (7d) on successful authentication', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: `login.test.${suffix}@test.com`, password: testUserPassword });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.user.email).toBe(`login.test.${suffix}@test.com`);
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Never leak password hash

      // Verify JWT token payload
      const decodedAccess = jwt.decode(res.body.data.accessToken) as jwt.JwtPayload;
      expect(decodedAccess.userId).toBeDefined();
      expect(decodedAccess.role).toBe('employee');
      expect(decodedAccess.companyId).toBe(fixture.company.id);

      // Verify expiration window roughly 15 minutes (900 seconds)
      const expiresInSec = decodedAccess.exp! - decodedAccess.iat!;
      expect(expiresInSec).toBe(15 * 60);
    });
  });

  describe('Token Expiry & Verification', () => {
    it('rejects an invalid access token with 401 Unauthorized', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', 'Bearer invalid-garbage-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects an expired access token with 401 Token Expired', async () => {
      const expiredToken = jwt.sign(
        { userId: '123', role: 'hr_admin', companyId: 'c1', departmentId: null },
        process.env.JWT_ACCESS_SECRET || 'test-access-secret',
        { expiresIn: '-1s' } // Expired 1 second ago
      );

      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('POST /auth/refresh', () => {
    it('exchanges a valid refresh token for a new access token and rotated refresh token', async () => {
      // 1. Log in to get tokens
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: `login.test.${suffix}@test.com`, password: testUserPassword });

      const { refreshToken } = loginRes.body.data;

      // 2. Refresh
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(refreshToken); // Token rotation
    });

    it('rejects an invalid refresh token with 401', async () => {
      const res = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'completely-invalid-refresh-token' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /auth/logout & Revocation', () => {
    it('invalidates the refresh token so it cannot be used again', async () => {
      // 1. Log in to get tokens
      const loginRes = await request(app)
        .post('/auth/login')
        .send({ email: `login.test.${suffix}@test.com`, password: testUserPassword });

      const { accessToken, refreshToken } = loginRes.body.data;

      // 2. Logout using the refresh token
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);

      // 3. Attempt to use the revoked refresh token -> Must be rejected with 401
      const refreshAttempt = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshAttempt.status).toBe(401);
      expect(refreshAttempt.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('Rate Limiting', () => {
    it('enforces login rate limiting on repeated failed attempts', async () => {
      const email = `ratelimit.${suffix}@test.com`;

      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({ email, password: 'WrongPassword' });
      }

      // 6th attempt should be blocked by loginLimiter with 429
      const blockedRes = await request(app)
        .post('/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({ email, password: 'WrongPassword' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_LOGIN_ATTEMPTS');
    });

    it('enforces general rate limiting on repeated general requests', async () => {
      // Send 100 requests to trigger the general limiter
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/health')
          .set('x-test-general-rate-limit', 'true');
      }

      // 101st request should be blocked with 429
      const blockedRes = await request(app)
        .get('/health')
        .set('x-test-general-rate-limit', 'true');

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_REQUESTS');
    });
  });
});
