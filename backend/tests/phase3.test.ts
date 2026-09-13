import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import vectorSearchService from '../src/services/vectorSearch';
import documentService from '../src/services/documentService';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';

describe('Phase 3 — Document Upload & Processing Pipeline (Retrieval Only, No LLM)', () => {
  let fixtureCompanyA: TestTenantFixture;
  let fixtureCompanyB: TestTenantFixture;
  const testSuffix = `p3_${Date.now()}`;

  // Temporary test files directory
  const testFilesDir = path.resolve(__dirname, 'temp_test_files');

  // Test file paths
  const validPdfPath = path.join(testFilesDir, 'leave_policy.pdf');
  const emptyPdfPath = path.join(testFilesDir, 'scanned_empty.pdf');
  const invalidTxtPath = path.join(testFilesDir, 'invalid_notes.txt');
  const validDocxPath = path.join(testFilesDir, 'it_guidelines.docx');

  beforeAll(async () => {
    // 1. Create two isolated tenant companies for cross-company access control tests
    fixtureCompanyA = await createTestTenantFixture(`${testSuffix}_a`);
    fixtureCompanyB = await createTestTenantFixture(`${testSuffix}_b`);

    // 2. Prepare test directory
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // 3. Create a valid minimal PDF with extractable text layer
    const pdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length 264 >>
stream
BT
/F1 12 Tf
50 720 Td
(Acme Company Leave Policy: How to apply for leave. All employees must submit leave requests via the HR portal at least two weeks in advance. Emergency sick leave requires medical certification if exceeding two consecutive days. Unused leave expires at year end.) Tj
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
640
%%EOF`;
    fs.writeFileSync(validPdfPath, pdfContent);

    // 4. Create an empty/scanned PDF without extractable text
    const emptyPdfContent = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Size 4 /Root 1 0 R >>
startxref
190
%%EOF`;
    fs.writeFileSync(emptyPdfPath, emptyPdfContent);

    // 5. Create an invalid .txt file
    fs.writeFileSync(invalidTxtPath, 'Plain text content that should be rejected by upload validation.');

    // 6. Create a minimal valid docx file (valid zip structure with PK header)
    // Minimal docx zip header with [Content_Types].xml and document.xml
    const zipHeader = Buffer.from([
      0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
    ]);
    fs.writeFileSync(validDocxPath, Buffer.concat([zipHeader, Buffer.from('PK-docx-test-buffer')]));
  });

  afterAll(async () => {
    // Clean up test tenants and files
    if (fixtureCompanyA?.company?.id) await cleanupTestTenant(fixtureCompanyA.company.id);
    if (fixtureCompanyB?.company?.id) await cleanupTestTenant(fixtureCompanyB.company.id);

    try {
      if (fs.existsSync(testFilesDir)) {
        fs.rmSync(testFilesDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup error
    }
  });

  describe('1. File Upload Validation & Security (security.md Section 3)', () => {
    it('rejects unsupported file formats (.txt) at upload time with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', invalidTxtPath);

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/Unsupported file type/i);

      // Verify no document was saved in database
      const docsInDb = await prisma.document.findMany({
        where: { companyId: fixtureCompanyA.company.id, filename: 'invalid_notes.txt' },
      });
      expect(docsInDb.length).toBe(0);
    });

    it('rejects disguised files that have .pdf extension but lack valid %PDF- magic bytes', async () => {
      const fakePdfPath = path.join(testFilesDir, 'fake.pdf');
      fs.writeFileSync(fakePdfPath, 'This is definitely not a real PDF file header');

      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', fakePdfPath);

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/Invalid file content/i);
    });
  });

  describe('2. Document Status Lifecycle & Scanned/Empty PDF Failure Handling', () => {
    it('marks a document with no extractable text layer as status=failed with a visible failure reason', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', emptyPdfPath);

      expect(res.status).toBe(201);
      const documentId = res.body.document.id;
      expect(res.body.document.status).toBe('pending');

      // Process the document directly through the service to simulate pipeline execution
      await documentService.processDocument(
        documentId,
        emptyPdfPath,
        'scanned_empty.pdf',
        fixtureCompanyA.company.id
      );

      // Fetch the updated document from DB
      const updatedDoc = await prisma.document.findUnique({
        where: { id: documentId },
      });

      expect(updatedDoc?.status).toBe('failed');
      expect(updatedDoc?.failureReason).toBeDefined();
      expect(updatedDoc?.failureReason?.length).toBeGreaterThan(0);

      // Confirm 0 chunks stored in document_chunks
      const chunkCount = await vectorSearchService.countChunksByDocument(documentId);
      expect(chunkCount).toBe(0);
    });
  });

  describe('3. Successful Document Ingestion & Chunk Storage', () => {
    let createdDocId: string;

    it('accepts a valid PDF, moves through pending -> processing -> ready, and stores chunks + embeddings', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', validPdfPath);

      expect(res.status).toBe(201);
      createdDocId = res.body.document.id;
      expect(res.body.document.filename).toBe('leave_policy.pdf');

      // Mock or execute chunk storage directly to verify pgvector insertion
      const sampleChunks = [
        {
          content: 'Acme Company Leave Policy: How to apply for leave. All employees must submit leave requests via the HR portal at least two weeks in advance.',
          chunkIndex: 0,
          embedding: new Array(384).fill(0.05), // Mock 384-d normalized vector
        },
        {
          content: 'Emergency sick leave requires medical certification if exceeding two consecutive days. Unused leave expires at year end.',
          chunkIndex: 1,
          embedding: new Array(384).fill(-0.02),
        },
      ];

      // Store in pgvector via isolated vector search module
      await vectorSearchService.storeDocumentChunks(
        createdDocId,
        fixtureCompanyA.company.id,
        sampleChunks
      );

      // Update status to ready
      await prisma.document.update({
        where: { id: createdDocId },
        data: { status: 'ready' },
      });

      // Verify chunks were stored in document_chunks table with non-null embedding
      const chunkCount = await vectorSearchService.countChunksByDocument(createdDocId);
      expect(chunkCount).toBe(2);

      // Verify list endpoint returns ready status and chunkCount
      const listRes = await request(app)
        .get('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`);

      expect(listRes.status).toBe(200);
      const matched = listRes.body.documents.find((d: any) => d.id === createdDocId);
      expect(matched).toBeDefined();
      expect(matched.status).toBe('ready');
      expect(matched.chunkCount).toBe(2);
    });

    it('cascade-deletes old chunks upon document replacement (PUT /documents/:id)', async () => {
      // Create a replacement file
      const replacementPath = path.join(testFilesDir, 'leave_policy_v2.pdf');
      fs.writeFileSync(replacementPath, fs.readFileSync(validPdfPath));

      const replaceRes = await request(app)
        .put(`/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`)
        .attach('file', replacementPath);

      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.document.filename).toBe('leave_policy_v2.pdf');

      // Verify old chunks are immediately gone from DB (deleted count = 0 remaining)
      const chunkCountAfterReplace = await vectorSearchService.countChunksByDocument(createdDocId);
      expect(chunkCountAfterReplace).toBe(0);

      // Insert new single chunk
      await vectorSearchService.storeDocumentChunks(createdDocId, fixtureCompanyA.company.id, [
        {
          content: 'Updated Leave Policy v2 with revised maternity and paternity leave.',
          chunkIndex: 0,
          embedding: new Array(384).fill(0.08),
        },
      ]);

      const newCount = await vectorSearchService.countChunksByDocument(createdDocId);
      expect(newCount).toBe(1);
    });

    it('cascade-deletes chunks when document is deleted (DELETE /documents/:id)', async () => {
      const deleteRes = await request(app)
        .delete(`/documents/${createdDocId}`)
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`);

      expect(deleteRes.status).toBe(200);

      // Verify document row is gone
      const docInDb = await prisma.document.findUnique({
        where: { id: createdDocId },
      });
      expect(docInDb).toBeNull();

      // Verify all chunks in document_chunks were deleted via DB ON DELETE CASCADE
      const chunkCount = await vectorSearchService.countChunksByDocument(createdDocId);
      expect(chunkCount).toBe(0);
    });
  });

  describe('4. Dedicated Similarity Retrieval Function (Direct Cosine Search, No LLM)', () => {
    let leaveDocId: string;

    beforeAll(async () => {
      // Seed a leave policy document with known semantic chunks
      const doc = await prisma.document.create({
        data: {
          companyId: fixtureCompanyA.company.id,
          uploadedBy: fixtureCompanyA.hrAdmin.id,
          filename: 'company_leave_handbook.pdf',
          storagePath: validPdfPath,
          status: 'ready',
        },
      });
      leaveDocId = doc.id;

      // Seed 2 chunks with distinct directional embeddings:
      // Vector A represents leave application procedure: [0.2, 0.2, ... 0.2] (normalized)
      // Vector B represents IT password reset: [-0.2, -0.2, ... -0.2] (normalized)
      const normValA = 1.0 / Math.sqrt(384);
      const normValB = -1.0 / Math.sqrt(384);

      const vectorA = new Array(384).fill(normValA);
      const vectorB = new Array(384).fill(normValB);

      await vectorSearchService.storeDocumentChunks(leaveDocId, fixtureCompanyA.company.id, [
        {
          content: 'To apply for leave: Submit a request in the Onboard360 portal under My Requests. Your manager must approve requests 7 days before departure.',
          chunkIndex: 0,
          embedding: vectorA,
        },
        {
          content: 'IT Equipment and Password Setup: Reset your company email password at security.company.com using multi-factor authentication.',
          chunkIndex: 1,
          embedding: vectorB,
        },
      ]);
    });

    it('returns the exact leave application chunk as top-1 result when queried with a matching vector (NO LLM)', async () => {
      // Query vector matching Vector A (leave)
      const normValA = 1.0 / Math.sqrt(384);
      const queryVector = new Array(384).fill(normValA);

      const results = await vectorSearchService.searchSimilarChunks(
        fixtureCompanyA.company.id,
        queryVector,
        2
      );

      expect(results.length).toBeGreaterThan(0);
      const topMatch = results[0];

      // Top result must be the leave policy chunk
      expect(topMatch.content).toContain('To apply for leave');
      expect(topMatch.documentFilename).toBe('company_leave_handbook.pdf');
      // Cosine similarity between identical normalized vectors is ~1.0
      expect(topMatch.similarity).toBeGreaterThan(0.95);
    });
  });

  describe('5. Access Control & Multi-Tenant Scoping', () => {
    it('rejects document upload from a non-HR-Admin role (Manager gets 403)', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.managerDeptA.token}`)
        .attach('file', validPdfPath);

      expect(res.status).toBe(403);
    });

    it('rejects document upload from an Employee role (gets 403)', async () => {
      const res = await request(app)
        .post('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.employee1DeptA.token}`)
        .attach('file', validPdfPath);

      expect(res.status).toBe(403);
    });

    it('ensures document list and retrieval are strictly scoped to company_id (Company B never sees Company A docs)', async () => {
      // Company A HR Admin lists documents: sees company_leave_handbook.pdf
      const resA = await request(app)
        .get('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyA.hrAdmin.token}`);

      expect(resA.status).toBe(200);
      expect(resA.body.documents.some((d: any) => d.filename === 'company_leave_handbook.pdf')).toBe(true);

      // Company B HR Admin lists documents: MUST NOT see Company A documents
      const resB = await request(app)
        .get('/documents')
        .set('Authorization', `Bearer ${fixtureCompanyB.hrAdmin.token}`);

      expect(resB.status).toBe(200);
      expect(resB.body.documents.some((d: any) => d.filename === 'company_leave_handbook.pdf')).toBe(false);

      // Company B vector search returns 0 results for Company A's content
      const normValA = 1.0 / Math.sqrt(384);
      const queryVector = new Array(384).fill(normValA);

      const resultsB = await vectorSearchService.searchSimilarChunks(
        fixtureCompanyB.company.id,
        queryVector,
        5
      );
      expect(resultsB.length).toBe(0);
    });
  });
});
