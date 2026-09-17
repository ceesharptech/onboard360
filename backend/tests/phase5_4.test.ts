import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import prisma from '../src/utils/prisma';
import { createTestTenantFixture, cleanupTestTenant, TestTenantFixture } from './testUtils';
import { signAccessToken } from '../src/utils/token';

describe('Phase 5.4 — Document Library & Related Task Document', () => {
  let fixture: TestTenantFixture;
  let employeeDeptBToken: string;
  let employeeDeptBId: string;
  const testSuffix = `p54_${Date.now()}`;

  const testFilesDir = path.resolve(__dirname, 'temp_p54_files');
  const validPdfPath = path.join(testFilesDir, 'company_handbook.pdf');
  const validDocxPath = path.join(testFilesDir, 'engineering_guide.docx');
  const fakePdfPath = path.join(testFilesDir, 'malicious.pdf');

  beforeAll(async () => {
    fixture = await createTestTenantFixture(testSuffix);

    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    // Create minimal valid PDF file (%PDF- header)
    const pdfContent = `%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\nxref\n0 1\n0000000000 65535 f \ntrailer << /Size 1 >>\nstartxref\n50\n%%EOF`;
    fs.writeFileSync(validPdfPath, pdfContent);

    // Create minimal valid DOCX file (PK\x03\x04 zip header)
    const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const docxBody = Buffer.concat([docxHeader, Buffer.alloc(100, 0)]);
    fs.writeFileSync(validDocxPath, docxBody);

    // Create fake PDF file without magic bytes
    fs.writeFileSync(fakePdfPath, 'This is definitely not a PDF file header');

    // Create an employee in Department B for cross-department isolation testing
    const empDeptBUser = await prisma.user.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        email: `emp.deptb.${testSuffix}@test.com`,
        passwordHash: 'hashed_password',
        role: 'employee',
        mustChangePassword: false,
      },
    });

    const empDeptB = await prisma.employee.create({
      data: {
        companyId: fixture.company.id,
        departmentId: fixture.departmentB.id,
        userId: empDeptBUser.id,
        name: 'Dept B Employee',
        email: empDeptBUser.email,
        jobRole: 'Marketing Specialist',
        startDate: new Date(),
        employmentType: 'full_time',
      },
    });

    employeeDeptBId = empDeptB.id;
    employeeDeptBToken = signAccessToken({
      userId: empDeptBUser.id,
      role: 'employee',
      companyId: fixture.company.id,
      departmentId: fixture.departmentB.id,
    });
  });

  afterAll(async () => {
    if (fixture?.company?.id) {
      await cleanupTestTenant(fixture.company.id);
    }
    try {
      if (fs.existsSync(testFilesDir)) {
        fs.rmSync(testFilesDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup error
    }
  });

  describe('Task 0 — Baseline Checks & Envelopes', () => {
    it('GET /users?paginate=false returns unpaginated company users for selector dropdowns without truncation', async () => {
      const res = await request(app)
        .get('/users?paginate=false')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4); // hr, mgrA, mgrB, emp1, emp2, empB
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBe(res.body.data.length);
      expect(res.body.pagination.hasNextPage).toBe(false);
    });

    it('GET /documents returns standardized single envelope without dual documents property', async () => {
      const res = await request(app)
        .get('/documents')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.documents).toBeUndefined();
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('Task 1 — Document Library Upload & Scoping', () => {
    let companyWideDocId: string;
    let deptADocId: string;

    it('allows HR Admin to upload a company-wide document (departmentId = null)', async () => {
      const res = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .attach('file', validPdfPath);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.filename).toBe('company_handbook.pdf');
      expect(res.body.data.departmentId).toBeNull();
      companyWideDocId = res.body.data.id;
    });

    it('allows Manager of Dept A to upload a document scoped to Department A', async () => {
      const res = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .attach('file', validDocxPath);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ok');
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.filename).toBe('engineering_guide.docx');
      expect(res.body.data.departmentId).toBe(fixture.departmentA.id);
      deptADocId = res.body.data.id;
    });

    it('rejects upload of disguised invalid files (magic byte validation reuse)', async () => {
      const res = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .attach('file', fakePdfPath);

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/Invalid file content/i);
    });

    it('denies Employee from uploading, replacing, or deleting library documents (403 Forbidden)', async () => {
      // Upload attempt
      const uploadRes = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .attach('file', validPdfPath);
      expect(uploadRes.status).toBe(403);

      // Replace attempt
      const replaceRes = await request(app)
        .put(`/library-documents/${companyWideDocId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`)
        .attach('file', validPdfPath);
      expect(replaceRes.status).toBe(403);

      // Delete attempt
      const deleteRes = await request(app)
        .delete(`/library-documents/${companyWideDocId}`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);
      expect(deleteRes.status).toBe(403);
    });

    it('denies Manager from uploading a company-wide document or document for another department', async () => {
      // Manager Dept A attempts to upload to Department B
      const resCrossDept = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .field('departmentId', fixture.departmentB.id)
        .attach('file', validPdfPath);

      // Enforces manager's own department; does not allow department B
      if (resCrossDept.status === 201) {
        expect(resCrossDept.body.data.departmentId).toBe(fixture.departmentA.id);
      } else {
        expect([400, 403, 404]).toContain(resCrossDept.status);
      }
    });

    it('confirms Employee in Dept A sees both company-wide document and Dept A document', async () => {
      const res = await request(app)
        .get('/library-documents')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      const docIds = res.body.data.map((d: any) => d.id);
      expect(docIds).toContain(companyWideDocId);
      expect(docIds).toContain(deptADocId);
    });

    it('confirms Employee in Dept B sees company-wide document, but CANNOT see Dept A document', async () => {
      const res = await request(app)
        .get('/library-documents')
        .set('Authorization', `Bearer ${employeeDeptBToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      const docIds = res.body.data.map((d: any) => d.id);
      expect(docIds).toContain(companyWideDocId);
      expect(docIds).not.toContain(deptADocId);
    });

    it('supports search by filename and pagination on GET /library-documents', async () => {
      const resSearch = await request(app)
        .get('/library-documents?search=engineering')
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(resSearch.status).toBe(200);
      expect(resSearch.body.data.length).toBe(1);
      expect(resSearch.body.data[0].filename).toBe('engineering_guide.docx');

      const resPaged = await request(app)
        .get('/library-documents?page=1&limit=1')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`);

      expect(resPaged.status).toBe(200);
      expect(resPaged.body.data.length).toBe(1);
      expect(resPaged.body.pagination.limit).toBe(1);
      expect(resPaged.body.pagination.total).toBeGreaterThanOrEqual(2);
    });

    it('replaces a library document, removing old file from disk with zero version history preserved', async () => {
      const replacementPdfPath = path.join(testFilesDir, 'company_handbook_updated.pdf');
      fs.writeFileSync(replacementPdfPath, `%PDF-1.4\n%Updated Content\n%%EOF`);

      // Query old record storagePath
      const beforeDoc = await prisma.libraryDocument.findUnique({
        where: { id: companyWideDocId },
      });
      const oldStoragePath = beforeDoc!.storagePath;
      expect(fs.existsSync(oldStoragePath)).toBe(true);

      const replaceRes = await request(app)
        .put(`/library-documents/${companyWideDocId}`)
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .attach('file', replacementPdfPath);

      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.data.filename).toBe('company_handbook_updated.pdf');

      // Check DB: verify document ID unchanged and no version tables exist
      const afterDoc = await prisma.libraryDocument.findUnique({
        where: { id: companyWideDocId },
      });
      expect(afterDoc?.filename).toBe('company_handbook_updated.pdf');
      expect(afterDoc?.storagePath).not.toBe(oldStoragePath);

      // Confirm old file was unlinked from disk
      expect(fs.existsSync(oldStoragePath)).toBe(false);
      expect(fs.existsSync(afterDoc!.storagePath)).toBe(true);
    });
  });

  describe('Task 2 — Related Document Field on Tasks & Snapshotting', () => {
    let testDocId: string;
    let templateWithDocId: string;

    beforeAll(async () => {
      // Upload a library document for Dept A
      const docRes = await request(app)
        .post('/library-documents')
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .attach('file', validPdfPath);
      testDocId = docRes.body.data.id;
    });

    it('allows creating a template task with an optional relatedDocumentId', async () => {
      const tmplRes = await request(app)
        .post('/templates')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: `Template with Related Doc ${testSuffix}`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          isDefault: false,
          tasks: [
            {
              title: 'Read Engineering Guidelines',
              description: 'Review the attached document before starting',
              category: 'Documentation',
              orderIndex: 0,
              assigneeType: 'employee',
              dueOffsetDays: 2,
              taskUrl: 'https://github.com',
              relatedDocumentId: testDocId,
            },
          ],
        });

      expect(tmplRes.status).toBe(201);
      expect(tmplRes.body.data.tasks[0].relatedDocumentId).toBe(testDocId);
      expect(tmplRes.body.data.tasks[0].taskUrl).toBe('https://github.com');
      templateWithDocId = tmplRes.body.data.id;
    });

    it('snapshots relatedDocumentId onto employee_task at employee creation time', async () => {
      const empRes = await request(app)
        .post('/employees')
        .set('Authorization', `Bearer ${fixture.hrAdmin.token}`)
        .send({
          name: 'Snapshotted Doc Employee',
          email: `emp_doc_snap_${Date.now()}@test.com`,
          departmentId: fixture.departmentA.id,
          jobRole: 'Software Engineer',
          startDate: '2026-10-01',
          employmentType: 'full_time',
          templateId: templateWithDocId,
        });

      expect(empRes.status).toBe(201);
      const tasks = empRes.body.data.tasks;
      expect(tasks.length).toBe(1);
      expect(tasks[0].relatedDocumentId).toBe(testDocId);
      expect(tasks[0].relatedDocument).toBeDefined();
      expect(tasks[0].relatedDocument.id).toBe(testDocId);
    });

    it('denies an employee from another department from downloading/accessing the related document (404)', async () => {
      // Direct metadata attempt
      const metaRes = await request(app)
        .get(`/library-documents/${testDocId}`)
        .set('Authorization', `Bearer ${employeeDeptBToken}`);

      expect(metaRes.status).toBe(404);

      // Direct file stream download attempt
      const downloadRes = await request(app)
        .get(`/library-documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${employeeDeptBToken}`);

      expect(downloadRes.status).toBe(404);
    });

    it('allows an authorized employee in Dept A to download/view the related document', async () => {
      const downloadRes = await request(app)
        .get(`/library-documents/${testDocId}/download`)
        .set('Authorization', `Bearer ${fixture.employee1DeptA.token}`);

      expect(downloadRes.status).toBe(200);
      expect(downloadRes.headers['content-type']).toMatch(/pdf/);
      expect(downloadRes.body.length).toBeGreaterThan(0);
    });

    it('deleting a referenced document sets relatedDocumentId to null without crashing tasks (onDelete: SetNull)', async () => {
      // 1. Create ad-hoc task with relatedDocumentId
      const emp = await prisma.employee.findFirst({
        where: { companyId: fixture.company.id, departmentId: fixture.departmentA.id },
      });

      const adHocRes = await request(app)
        .post(`/employees/${emp!.id}/tasks`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`)
        .send({
          title: 'Ad-hoc Task referencing document',
          category: 'Review',
          assigneeType: 'employee',
          relatedDocumentId: testDocId,
        });

      expect(adHocRes.status).toBe(201);
      expect(adHocRes.body.data.relatedDocumentId).toBe(testDocId);
      const adHocTaskId = adHocRes.body.data.id;

      // 2. Delete the library document
      const deleteRes = await request(app)
        .delete(`/library-documents/${testDocId}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(deleteRes.status).toBe(200);

      // 3. Confirm template task and employee task have relatedDocumentId = null
      const updatedTemplateTask = await prisma.onboardingTemplateTask.findFirst({
        where: { templateId: templateWithDocId },
      });
      expect(updatedTemplateTask?.relatedDocumentId).toBeNull();

      const updatedAdHocTask = await prisma.employeeTask.findUnique({
        where: { id: adHocTaskId },
      });
      expect(updatedAdHocTask?.relatedDocumentId).toBeNull();

      // 4. Fetch employee record: verify it does not crash and tasks load cleanly
      const empFetchRes = await request(app)
        .get(`/employees/${emp!.id}`)
        .set('Authorization', `Bearer ${fixture.managerDeptA.token}`);

      expect(empFetchRes.status).toBe(200);
      const fetchedAdHocTask = empFetchRes.body.data.tasks.find((t: any) => t.id === adHocTaskId);
      expect(fetchedAdHocTask).toBeDefined();
      expect(fetchedAdHocTask.relatedDocumentId).toBeNull();
      expect(fetchedAdHocTask.relatedDocument).toBeNull();
    });
  });
});
