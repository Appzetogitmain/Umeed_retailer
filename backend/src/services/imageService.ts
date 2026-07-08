import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { UPLOADS_ROOT } from '../utils/ensureUploadDirs';

export interface UploadResult {
  url: string;
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
}

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
  preset?: string;
}

// Sharp presets map
export const IMAGE_PRESETS: Record<string, { width?: number; height?: number; quality?: number }> = {
  products:   { width: 1200, height: 1200, quality: 82 },
  categories: { width: 800,  height: 800,  quality: 78 },
  banners:    { width: 1920, height: 600,  quality: 85 },
  profile:    { width: 400,  height: 400,  quality: 75 },
  store:      { width: 1200, height: 800,  quality: 80 },
  documents:  {}, // no Sharp processing for PDFs
};

// Folder constants (replaces CLOUDINARY_FOLDERS)
export const IMAGE_FOLDERS = {
  PRODUCTS:          'products',
  PRODUCT_GALLERY:   'products',
  CATEGORIES:        'categories',
  SUBCATEGORIES:     'categories',
  BANNERS:           'banners',
  SELLERS:           'profile',
  SELLER_PROFILE:    'profile',
  SELLER_DOCUMENTS:  'documents',
  DELIVERY:          'profile',
  DELIVERY_DOCUMENTS:'documents',
  STORES:            'store',
  COUPONS:           'categories',
  USERS:             'profile',
} as const;

function getBackendUrl(): string {
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export async function validateImageBuffer(buffer: Buffer, mimetype: string, maxBytes: number): Promise<void> {
  if (buffer.length > maxBytes) {
    throw new Error(`File size exceeds maximum limit of ${maxBytes / (1024 * 1024)}MB`);
  }
  
  if (buffer.length < 10) {
    throw new Error('File is too small or corrupt.');
  }

  const hex = buffer.toString('hex', 0, 4).toUpperCase();
  let isValid = false;

  if (mimetype === 'application/pdf' && hex.startsWith('25504446')) {
    isValid = true;
  } else if (mimetype.startsWith('image/')) {
    if (hex.startsWith('89504E47')) isValid = true; // PNG
    if (hex.startsWith('FFD8FF')) isValid = true; // JPEG
    if (hex.startsWith('47494638')) {
        isValid = true; // GIF
        if (buffer.length > 500 * 1024) {
             throw new Error('GIF images must be smaller than 500KB');
        }
    }
    if (buffer.toString('utf8', 0, 4) === 'RIFF') isValid = true; // WebP
  }

  if (!isValid) {
    throw new Error('Invalid file content type or corrupted file.');
  }
  
  // Try sharp metadata for images to verify min dims
  if (mimetype.startsWith('image/')) {
    try {
        const metadata = await sharp(buffer).metadata();
        if ((metadata.width || 0) < 10 || (metadata.height || 0) < 10) {
            throw new Error('Image dimensions too small (minimum 10x10).');
        }
    } catch(err: any) {
        throw new Error('Failed to decode image: ' + err.message);
    }
  }
}

export async function uploadImageFromBuffer(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
  let folder = options.folder || IMAGE_FOLDERS.PRODUCTS;
  
  // Force convert backslashes to forward slashes just in case Windows is being weird
  folder = folder.replace(/\\/g, '/');
  
  // Sanitize folder to prevent slash issues on local disk since frontend sends 'Speedoo/products'
  if (folder.includes('/')) {
      folder = folder.split('/').pop() || IMAGE_FOLDERS.PRODUCTS;
  }
  
  if (folder === 'gallery' || folder === 'Speedoo') {
      folder = 'products'; // Map gallery to products
  }

  const presetKey = folder === 'products' ? 'products' : 
                   folder === 'categories' ? 'categories' : 
                   folder === 'banners' ? 'banners' : 
                   folder === 'profile' ? 'profile' : 
                   folder === 'store' ? 'store' : 'products';
  
  const preset = IMAGE_PRESETS[presetKey];
  
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  const filename = `${folder}-${timestamp}-${uuid}.webp`;
  const tempPath = path.join(UPLOADS_ROOT, 'temp', filename);

  const pipeline = sharp(buffer);
  
  if (preset && preset.width && preset.height) {
     pipeline.resize(preset.width, preset.height, { fit: 'inside', withoutEnlargement: true });
  }
  
  const info = await pipeline.webp({ quality: preset.quality || 80 }).toFile(tempPath);
  
  const finalPath = path.join(UPLOADS_ROOT, folder, filename);
  fs.renameSync(tempPath, finalPath);
  
  const fileUrl = `${getBackendUrl()}/uploads/${folder}/${filename}`;
  
  return {
    url: fileUrl,
    secureUrl: fileUrl,
    publicId: `local-${folder}/${filename}`,
    width: info.width,
    height: info.height,
    format: 'webp',
    bytes: info.size,
  };
}

export async function uploadDocumentFromBuffer(buffer: Buffer, options: UploadOptions): Promise<UploadResult> {
  let folder = options.folder || IMAGE_FOLDERS.SELLER_DOCUMENTS;
  
  if (folder.includes('/')) {
      folder = folder.split('/').pop() || IMAGE_FOLDERS.SELLER_DOCUMENTS;
  }

  const isImage = options.resourceType === 'image';
  
  if (isImage) {
      return uploadImageFromBuffer(buffer, { ...options, folder });
  }

  const uuid = crypto.randomUUID();
  const timestamp = Date.now();
  // Attempt to guess extension from magic bytes, fallback to pdf
  let ext = 'pdf';
  if (buffer.length > 4) {
      const hex = buffer.toString('hex', 0, 4).toUpperCase();
      if (hex.startsWith('89504E47')) ext = 'png';
      if (hex.startsWith('FFD8FF')) ext = 'jpg';
      if (hex.startsWith('47494638')) ext = 'gif';
  }

  const filename = `document-${timestamp}-${uuid}.${ext}`;
  const finalPath = path.join(UPLOADS_ROOT, folder, filename);

  fs.writeFileSync(finalPath, buffer);
  
  const fileUrl = `${getBackendUrl()}/uploads/${folder}/${filename}`;
  
  return {
    url: fileUrl,
    secureUrl: fileUrl,
    publicId: `local-${folder}/${filename}`,
    format: ext,
    bytes: buffer.length,
  };
}

export async function deleteImage(publicId: string): Promise<void> {
  if (publicId && publicId.startsWith('local-')) {
    const relPath = publicId.replace('local-', '');
    const fullPath = path.join(UPLOADS_ROOT, relPath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
    return;
  }
  
  // If not local, it might be cloudinary
  try {
     const cloudinary = require('../config/cloudinary').default;
     await cloudinary.uploader.destroy(publicId);
  } catch(e) {
     console.error('Failed to delete from cloudinary:', e);
  }
}

export async function deleteMultipleImages(publicIds: string[]): Promise<void> {
    for (const id of publicIds) {
        await deleteImage(id);
    }
}

export function cleanupTempFiles(): void {
    const tempDir = path.join(UPLOADS_ROOT, 'temp');
    if (!fs.existsSync(tempDir)) return;
    
    const now = Date.now();
    const files = fs.readdirSync(tempDir);
    
    files.forEach(file => {
        const filePath = path.join(tempDir, file);
        const stats = fs.statSync(filePath);
        // Delete older than 1 hour
        if (now - stats.mtimeMs > 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up orphan temp file: ${file}`);
        }
    });
}
