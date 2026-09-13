import { randomBytes } from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { ATTACHMENTS_DIR } from './database.js';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export function createUploadMiddleware() {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => callback(null, ATTACHMENTS_DIR),
      filename: (_req, file, callback) => callback(null, `${randomBytes(16).toString('hex')}${path.extname(file.originalname)}`),
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      if (allowedMimeTypes.has(file.mimetype)) return callback(null, true);
      callback(new Error('Tipo de arquivo não permitido.'));
    },
  });
}
