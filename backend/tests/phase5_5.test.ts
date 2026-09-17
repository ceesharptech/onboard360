import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 5.5 — Training & Guides', () => {
  let fixture: TestTenantFixture;
  let tenantB: TestTenantFixture;
  const testSuffix = `p55_${Date.now()}`;
  const suffixB = `p55b_${Date.now()}`;

  let createdVideoId: string;
  let createdGuideId: string;

  beforeAll(async () => {
    fixture = await createTestTenantFixture(testSuffix);
    tenantB = await createTestTenantFixture(suffixB);
  });

  afterAll(async () => {
    // Clean up created training entries for both tenants
    await prisma.trainingEntry.deleteMany({
      where: {
        companyId: { in: [fixture.company.id, tenantB.company.id] },
      },
    });

    await cleanupTestTenant(fixture.company.id);
    await cleanupTestTenant(tenantB.company.id);
  });

  describe('Task 1 — Video Training Entries & YouTube Validation', () => {
    it('creates a video training entry with valid standard YouTube URL and returns reconstructed embedUrl', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Welcome & Company Overview Video',
          description: 'A 5-minute video introducing company values and tools.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data).toBeDefined();
      expect(res.body.data.title).toBe('Welcome & Company Overview Video');
      expect(res.body.data.contentType).toBe('video');
      expect(res.body.data.youtubeVideoId).toBe('dQw4w9WgXcQ');
      expect(res.body.data.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(res.body.data.guideContent).toBeNull();
      createdVideoId = res.body.data.id;
    });

    it('creates a video training entry with short youtu.be URL correctly extracting video ID', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Workspace Setup Short Link',
          description: 'Setup walkthrough using short URL.',
          contentType: 'video',
          youtubeUrl: 'https://youtu.be/9bZkp7q19f0?t=42',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.youtubeVideoId).toBe('9bZkp7q19f0');
      expect(res.body.data.embedUrl).toBe('https://www.youtube.com/embed/9bZkp7q19f0');
    });

    it('creates a video training entry with embed YouTube URL correctly extracting video ID', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Security Awareness Embed Link',
          description: 'Security training video.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/embed/L_LUpnjgPso',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.youtubeVideoId).toBe('L_LUpnjgPso');
      expect(res.body.data.embedUrl).toBe('https://www.youtube.com/embed/L_LUpnjgPso');
    });

    it('rejects video creation with non-YouTube domain (e.g. Vimeo) with 400 error', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Vimeo Video Attempt',
          description: 'Should fail because domain is not YouTube.',
          contentType: 'video',
          youtubeUrl: 'https://vimeo.com/76979871',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message.toLowerCase()).toContain('youtube');
    });

    it('rejects video creation with malformed YouTube URL lacking 11-char video ID with 400 error', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Invalid Video ID Attempt',
          description: 'Should fail because ID is invalid.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/watch?v=too_short',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.message.toLowerCase()).toContain('11-character');
    });

    it('rejects video creation with YouTube URL missing video ID parameter entirely', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Empty Watch Query Attempt',
          description: 'Should fail because no v parameter exists.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/watch',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Task 1 — Written Guide Training Entries (Markdown)', () => {
    it('creates a guide training entry with Markdown content and null video fields', async () => {
      const markdownContent = `
# Engineering Onboarding Guide

Welcome to the team! Here is your quick start checklist:
- Clone repo from GitHub
- Run \`npm install\`
- Set up \`.env\` from \`.env.example\`

For more information, see [Internal Wiki](https://wiki.example.com).
      `.trim();

      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Engineering Onboarding Written Guide',
          description: 'Step-by-step developer environment setup instructions.',
          contentType: 'guide',
          guideContent: markdownContent,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.contentType).toBe('guide');
      expect(res.body.data.guideContent).toContain('# Engineering Onboarding Guide');
      expect(res.body.data.youtubeVideoId).toBeNull();
      expect(res.body.data.embedUrl).toBeNull();
      createdGuideId = res.body.data.id;
    });

    it('rejects guide creation with empty guideContent with 400 error', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Empty Guide Attempt',
          description: 'Has no guideContent.',
          contentType: 'guide',
          guideContent: '',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('Task 1 — Access Control & Role Scoping', () => {
    it('allows Employee to list training entries', async () => {
      const res = await request(app)
        .get('/training')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('allows Manager to list training entries', async () => {
      const res = await request(app)
        .get('/training')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('allows Employee and Manager to view a single training entry with embedUrl', async () => {
      const empRes = await request(app)
        .get(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(empRes.status).toBe(200);
      expect(empRes.body.data.id).toBe(createdVideoId);
      expect(empRes.body.data.embedUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');

      const mgrRes = await request(app)
        .get(`/training/${createdGuideId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(mgrRes.status).toBe(200);
      expect(mgrRes.body.data.id).toBe(createdGuideId);
      expect(mgrRes.body.data.guideContent).toContain('# Engineering Onboarding Guide');
    });

    it('rejects Employee creating a training entry with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({
          title: 'Employee Unauthorized Video',
          description: 'Should be rejected.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });

      expect(res.status).toBe(403);
    });

    it('rejects Manager creating a training entry with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          title: 'Manager Unauthorized Video',
          description: 'Should be rejected.',
          contentType: 'video',
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        });

      expect(res.status).toBe(403);
    });

    it('rejects Employee and Manager updating a training entry with 403 Forbidden', async () => {
      const empRes = await request(app)
        .put(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .send({ title: 'Hacked Title' });

      expect(empRes.status).toBe(403);

      const mgrRes = await request(app)
        .put(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({ title: 'Manager Title' });

      expect(mgrRes.status).toBe(403);
    });

    it('rejects Employee and Manager deleting a training entry with 403 Forbidden', async () => {
      const empRes = await request(app)
        .delete(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(empRes.status).toBe(403);

      const mgrRes = await request(app)
        .delete(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(mgrRes.status).toBe(403);
    });

    it('allows HR Admin to update a training entry', async () => {
      const res = await request(app)
        .put(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Updated Company Overview Video',
          description: 'Refined description for new hires.',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Company Overview Video');
      expect(res.body.data.description).toBe('Refined description for new hires.');
    });

    it('allows HR Admin to delete a training entry', async () => {
      // Create a temporary entry to delete
      const createRes = await request(app)
        .post('/training')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          title: 'Temporary Training Entry',
          description: 'To be deleted.',
          contentType: 'guide',
          guideContent: 'Temporary content.',
        });

      const tempId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/training/${tempId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(deleteRes.status).toBe(200);

      // Verify it's gone
      const getRes = await request(app)
        .get(`/training/${tempId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('Task 1 — Search, Filter & Pagination', () => {
    it('correctly paginates training entries list', async () => {
      const res = await request(app)
        .get('/training?page=1&limit=2')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.limit).toBe(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('filters training entries by case-insensitive title search', async () => {
      const res = await request(app)
        .get('/training?search=overview')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].title.toLowerCase()).toContain('overview');
    });

    it('filters training entries by contentType', async () => {
      const res = await request(app)
        .get('/training?contentType=guide')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((e: any) => e.contentType === 'guide')).toBe(true);
    });
  });

  describe('Task 1 — Multi-Tenant Scoping & Invariant Check', () => {
    it('isolates training entries between companies (Company B cannot see Company A entries)', async () => {
      const tenantBRes = await request(app)
        .get('/training')
        .set('Authorization', `Bearer ${tenantB.hrAdmin.token}`);

      expect(tenantBRes.status).toBe(200);
      const tenantBIds = tenantBRes.body.data.map((e: any) => e.id);
      expect(tenantBIds).not.toContain(createdVideoId);
      expect(tenantBIds).not.toContain(createdGuideId);

      // Attempt direct get
      const directGet = await request(app)
        .get(`/training/${createdVideoId}`)
        .set('Authorization', `Bearer ${tenantB.hrAdmin.token}`);

      expect(directGet.status).toBe(404);
    });

    it('INVARIANT CHECK: pgvector HNSW index on document_chunks table remains present', async () => {
      const indexes: any = await prisma.$queryRaw`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'document_chunks' AND indexname = 'document_chunks_embedding_idx'
      `;

      expect(indexes.length).toBe(1);
      expect(indexes[0].indexname).toBe('document_chunks_embedding_idx');
    });
  });
});
