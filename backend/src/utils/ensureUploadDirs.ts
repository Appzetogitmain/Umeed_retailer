import fs from 'fs';
import path from 'path';

export const UPLOADS_ROOT = path.resolve(__dirname, '../../uploads');

export const DIRS = [
  'products',
  'categories',
  'banners',
  'profile',
  'store',
  'documents',
  'temp',
];

export function ensureUploadDirs() {
  if (!fs.existsSync(UPLOADS_ROOT)) {
    fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
  }
  
  DIRS.forEach(dir => {
    const dirPath = path.join(UPLOADS_ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
}
