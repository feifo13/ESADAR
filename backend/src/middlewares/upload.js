import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

fs.mkdirSync(env.articleUploadDir, { recursive: true });
const siteHeroUploadDir = path.join(env.uploadDir, 'site-hero');
fs.mkdirSync(siteHeroUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.articleUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error('Only jpg, jpeg, png and webp files are allowed'));
  }
  return cb(null, true);
}

export const uploadArticleImages = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadBytes,
    files: 10,
  },
});

const siteHeroStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, siteHeroUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

export const uploadSiteHeroImage = multer({
  storage: siteHeroStorage,
  fileFilter,
  limits: {
    fileSize: env.maxUploadBytes,
    files: 10,
  },
});

function importFileFilter(_req, file, cb) {
  const allowedMimeTypes = [
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.ms-excel',
  ];

  const fileName = String(file.originalname || '').toLowerCase();
  const hasAllowedExtension = fileName.endsWith('.csv');

  if (!allowedMimeTypes.includes(file.mimetype) && !hasAllowedExtension) {
    return cb(new Error('Only csv files are allowed for import'));
  }

  if (!hasAllowedExtension) {
    return cb(new Error('Only .csv files are allowed for import'));
  }

  return cb(null, true);
}

export const uploadArticleImportFile = multer({
  storage: multer.memoryStorage(),
  fileFilter: importFileFilter,
  limits: {
    fileSize: env.maxUploadBytes,
    files: 1,
  },
});
