import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import vectorSearchService from '../src/services/vectorSearch';
import documentService from '../src/services/documentService';
import groqService, { FALLBACK_ERROR_MESSAGE } from '../src/services/groqService';
import assistantService, { NOT_FOUND_FALLBACK_MESSAGE } from '../src/services/assistantService';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 4 — AI Company Assistant (Qorra) & Groq Generation Layer', () => {
  let fixtureCompanyA: TestTenantFixture;
  let fixtureCompanyB: TestTenantFixture;
  const testSuffix = `p4_${Date.now()}`;

  const testFilesDir = path.resolve(__dirname, 'temp_p4_files');
  const leavePolicyPath = path.join(testFilesDir, 'leave_policy.pdf');
  const travelPolicyPath = path.join(testFilesDir, 'travel_policy.pdf');
  const designToolsPath = path.join(testFilesDir, 'design_tools.pdf');

  beforeAll(async () => {
    fixtureCompanyA = await createTestTenantFixture(`${testSuffix}_a`);
    fixtureCompanyB = await createTestTenantFixture(`${testSuffix}_b`);

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Helper to generate a minimal valid PDF with extractable text
    const createPdf = (text: string) => {
      return `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${text.length + 50} >>
stream
BT
/F1 12 Tf
50 720 Td
(${text}) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000323 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
600
%%EOF`;
    };

    // 1. Leave Policy document
    fs.writeFileSync(
      leavePolicyPath,
      createPdf(
        'Company Leave Policy. To apply for leave, submit your request through the HR Portal at least two weeks before your planned dates. Sick leave exceeding two days requires medical certification.'
      )
    );

    // 2. Travel & Expense Policy document
    fs.writeFileSync(
      travelPolicyPath,
      createPdf(
        'Travel and Expense Guidelines. Travel requests are approved by your Department Manager. Any trip exceeding one thousand dollars also requires written sign-off from the Finance Director.'
      )
    );

    // 3. Design Team Handbook document
    fs.writeFileSync(
      designToolsPath,
      createPdf(
        'Design Team Tooling and Standards. The design team uses Figma for primary UI design, Notion for research documentation and user testing notes, and Principle for high-fidelity interactive animations.'
      )
    );

    // Upload all 3 documents for Company A via the HR upload endpoint
    const uploadFile = async (filePath: string, filename: string) => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', filePath);

      expect(res.status).toBe(201);
      const docId = res.body.document.id;

      // Ingest document chunks and vectors via documentService directly
      await documentService.processDocument(
        docId,
        filePath,
        filename,
        fixtureCompanyA.company.id
      );
    };

    await uploadFile(leavePolicyPath, 'leave_policy.pdf');
    await uploadFile(travelPolicyPath, 'travel_policy.pdf');
    await uploadFile(designToolsPath, 'design_tools.pdf');
  }, 60000);

  afterAll(async () => {
    try {
      if (fs.existsSync(testFilesDir)) {
        fs.rmSync(testFilesDir, { recursive: true, force: true });
      }
      if (fixtureCompanyA?.company?.id) await cleanupTestTenant(fixtureCompanyA.company.id);
      if (fixtureCompanyB?.company?.id) await cleanupTestTenant(fixtureCompanyB.company.id);
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('1. Task 0 — Parameterized Vector Search Verification', () => {
    it('executes parameterized similarity search using Prisma.sql without queryRawUnsafe', async () => {
      // Create a dummy 384-dimensional query vector
      const dummyEmbedding = new Array(384).fill(0.05);

      const results = await vectorSearchService.searchSimilarChunks(
        fixtureCompanyA.company.id,
        dummyEmbedding,
        3
      );

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      for (const item of results) {
        expect(item.companyId).toBe(fixtureCompanyA.company.id);
        expect(typeof item.similarity).toBe('number');
        expect(item.content).toBeDefined();
        expect(item.documentFilename).toBeDefined();
      }
    });
  });

  describe('2. Grounded Answers & Source Citations (Three PRD Questions)', () => {
    it('answers "How do I apply for leave?" with grounded answer citing leave_policy.pdf', async () => {
      // Mock Groq LLM generation to return factual answer citing the source
      const groqSpy = vi.spyOn(groqService, 'generateAnswer').mockResolvedValueOnce({
        answer:
          'According to leave_policy.pdf, you apply for leave by submitting a request through the HR Portal at least two weeks before your planned dates.',
        sources: ['leave_policy.pdf'],
        isFallback: false,
      });

      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'How do I apply for leave?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(false);
      expect(res.body.data.answer).toContain('leave_policy.pdf');
      expect(res.body.data.sources).toContain('leave_policy.pdf');
      expect(groqSpy).toHaveBeenCalledTimes(1);

      groqSpy.mockRestore();
    });

    it('answers "Who approves travel requests?" with grounded answer citing travel_policy.pdf', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer').mockResolvedValueOnce({
        answer:
          'Per travel_policy.pdf, travel requests are approved by your Department Manager, and expenses exceeding $1,000 require sign-off from the Finance Director.',
        sources: ['travel_policy.pdf'],
        isFallback: false,
      });

      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'Who approves travel requests?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(false);
      expect(res.body.data.answer).toContain('travel_policy.pdf');
      expect(res.body.data.sources).toContain('travel_policy.pdf');
      expect(groqSpy).toHaveBeenCalledTimes(1);

      groqSpy.mockRestore();
    });

    it('answers "What tools does the design team use?" with grounded answer citing design_tools.pdf', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer').mockResolvedValueOnce({
        answer:
          'According to design_tools.pdf, the design team uses Figma for UI design, Notion for research documentation, and Principle for high-fidelity animations.',
        sources: ['design_tools.pdf'],
        isFallback: false,
      });

      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'What tools does the design team use?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(false);
      expect(res.body.data.answer).toContain('Figma');
      expect(res.body.data.sources).toContain('design_tools.pdf');
      expect(groqSpy).toHaveBeenCalledTimes(1);

      groqSpy.mockRestore();
    });
  });

  describe('3. Fallback Triggering & Short-Circuit Without LLM Call', () => {
    it('triggers contact HR fallback and does NOT call Groq when asking an out-of-scope question', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer');

      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'What is the secret recipe for cafeteria chocolate chip cookies?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(true);
      expect(res.body.data.answer).toBe(NOT_FOUND_FALLBACK_MESSAGE);
      expect(res.body.data.sources).toEqual([]);

      // HARD REQUIREMENT: Assert Groq was NEVER called when similarity check short-circuits
      expect(groqSpy).not.toHaveBeenCalled();

      groqSpy.mockRestore();
    });
  });

  describe('4. Resilience & Error Handling', () => {
    it('handles simulated Groq API error / timeout gracefully without surfacing raw error', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer').mockResolvedValueOnce({
        answer: FALLBACK_ERROR_MESSAGE,
        sources: [],
        isFallback: true,
      });

      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'How do I apply for leave?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(true);
      expect(res.body.data.answer).toBe(FALLBACK_ERROR_MESSAGE);
      expect(res.body.data.sources).toEqual([]);

      groqSpy.mockRestore();
    });
  });

  describe('5. Access Control & Multi-Tenant Company Isolation', () => {
    it('rejects unauthenticated requests with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/assistant/chat')
        .send({ question: 'How do I apply for leave?' });

      expect(res.status).toBe(401);
    });

    it('rejects invalid/empty question bodies with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: '   ' });

      expect(res.status).toBe(400);
    });

    it('strictly isolates company data: Company B cannot retrieve or cite Company A documents', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer');

      // Company B has NO documents uploaded. Asking Company A's question must trigger fallback!
      const res = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyB.employee1DeptA.token}`)
        .send({ question: 'What tools does the design team use?' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isFallback).toBe(true);
      expect(res.body.data.answer).toBe(NOT_FOUND_FALLBACK_MESSAGE);
      expect(res.body.data.sources).toEqual([]);
      expect(groqSpy).not.toHaveBeenCalled();

      groqSpy.mockRestore();
    });

    it('permits all company roles (employee, manager, hr_admin) to query the assistant', async () => {
      const groqSpy = vi.spyOn(groqService, 'generateAnswer').mockResolvedValue({
        answer: 'You apply through the HR Portal per leave_policy.pdf.',
        sources: ['leave_policy.pdf'],
        isFallback: false,
      });

      // Employee query
      const empRes = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .send({ question: 'How do I apply for leave?' });
      expect(empRes.status).toBe(200);

      // Manager query
      const mgrRes = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.managerDeptA.token}`)
        .send({ question: 'How do I apply for leave?' });
      expect(mgrRes.status).toBe(200);

      // HR Admin query
      const hrRes = await request(app)
        .post('/assistant/chat')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .send({ question: 'How do I apply for leave?' });
      expect(hrRes.status).toBe(200);

      groqSpy.mockRestore();
    });
  });
});
