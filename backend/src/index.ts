import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Local file storage path for development uploads.
// NOTE: This local file storage path is swapped for Cloudflare R2 / Backblaze B2 at deployment (Phase 6).
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});

export default app;
