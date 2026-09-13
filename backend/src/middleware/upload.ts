/**
 * File upload middleware for document ingestion.
 *
 * Implements strict security controls per security.md Section 3:
 * - Validates file extension (.pdf, .docx only)
 * - Inspects magic bytes (PDF header %PDF-, DOCX zip header PK\x03\x04)
 * - Enforces maximum file size (15MB)
 * - Rejects any unsupported or executable file types before reaching processing
 */

import fs from 'fs';
import path from 'path';
import multer, { MulterError } from 'multer';
import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// 15MB max file size limit
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const sanitizedOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${timestamp}-${sanitizedOriginal}`);
  },
});

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf' || ext === '.docx') {
    cb(null, true);
  } else {
    cb(
      new BadRequestError(
        `Unsupported file type '${ext}'. Only PDF (.pdf) and Word (.docx) documents are accepted.`,
        'UNSUPPORTED_FILE_TYPE'
      )
    );
  }
};

const rawMulter = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter,
});

/**
 * Express middleware wrapper to catch Multer errors (e.g. file size limit) and normalize to BadRequestError.
 */
export const uploadFile = (fieldName = 'file') => {
  const single = rawMulter.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    single(req, res, (err: unknown) => {
      if (err) {
        if (err instanceof MulterError) {
          return next(new BadRequestError(err.message, 'FILE_UPLOAD_ERROR'));
        }
        return next(err);
      }
      next();
    });
  };
};

export const uploadMiddleware = rawMulter;

/**
 * Validates file buffer magic bytes to ensure file content matches extension.
 * Rejects disguised executables, scripts, or non-PDF/DOCX content.
 */
export const validateMagicBytes = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.file) {
    res.status(400).json({ error: { message: 'No document file uploaded' } });
    return;
  }

  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    if (ext === '.pdf') {
      // PDF must begin with %PDF- (0x25 0x50 0x44 0x46 0x2D)
      const pdfHeader = buffer.slice(0, 5).toString('ascii');
      if (pdfHeader !== '%PDF-') {
        fs.unlinkSync(filePath);
        res.status(400).json({
          error: {
            message: 'Invalid file content. File claims to be PDF but lacks a valid PDF header.',
          },
        });
        return;
      }
    } else if (ext === '.docx') {
      // DOCX is a zip archive beginning with PK\x03\x04 (0x50 0x4b 0x03 0x04)
      const isZip =
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04;
      if (!isZip) {
        fs.unlinkSync(filePath);
        res.status(400).json({
          error: {
            message: 'Invalid file content. File claims to be DOCX but lacks a valid zip header.',
          },
        });
        return;
      }
    }

    next();
  } catch (err: unknown) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    next(err);
  }
};
