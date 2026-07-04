import cloudinary, { CLOUDINARY_FOLDERS } from "../config/cloudinary";
import { UploadApiErrorResponse } from "cloudinary";
import fs from "fs";
import path from "path";

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
  resourceType?: "image" | "raw" | "video" | "auto";
  transformation?: any[];
  overwrite?: boolean;
  invalidate?: boolean;
}

const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

function getBackendUrl(): string {
  const baseUrl = process.env.BACKEND_URL || "http://localhost:5000";
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

function getExtensionFromBuffer(buffer: Buffer, defaultExt: string): string {
  if (buffer.length > 4) {
    const hex = buffer.toString("hex", 0, 4);
    if (hex.startsWith("89504e47")) return ".png";
    if (hex.startsWith("ffd8ff")) return ".jpg";
    if (hex.startsWith("47494638")) return ".gif";
    if (hex.startsWith("25504446")) return ".pdf";
    if (buffer.toString("utf8", 0, 4) === "RIFF") return ".webp";
  }
  return defaultExt;
}

async function saveFileLocally(filePath: string): Promise<UploadResult> {
  ensureUploadsDir();
  const filename = `${Date.now()}-${path.basename(filePath)}`;
  const destPath = path.join(UPLOADS_DIR, filename);
  fs.copyFileSync(filePath, destPath);
  
  const backendUrl = getBackendUrl();
  const fileUrl = `${backendUrl}/uploads/${filename}`;
  const stats = fs.statSync(destPath);
  
  return {
    url: fileUrl,
    secureUrl: fileUrl,
    publicId: `local-${filename}`,
    format: path.extname(filename).slice(1),
    bytes: stats.size,
  };
}

async function saveBufferLocally(buffer: Buffer, resourceType: string): Promise<UploadResult> {
  ensureUploadsDir();
  const ext = getExtensionFromBuffer(buffer, resourceType === "raw" ? ".pdf" : ".jpg");
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
  const destPath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(destPath, buffer);
  
  const backendUrl = getBackendUrl();
  const fileUrl = `${backendUrl}/uploads/${filename}`;
  
  return {
    url: fileUrl,
    secureUrl: fileUrl,
    publicId: `local-${filename}`,
    format: ext.slice(1),
    bytes: buffer.length,
  };
}

/**
 * Upload a single image to Cloudinary
 */
export async function uploadImage(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.PRODUCTS,
      resource_type: options.resourceType || "image",
      transformation: options.transformation,
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return {
      url: result.url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error: any) {
    console.warn("Cloudinary upload failed, falling back to local storage:", error.message);
    return saveFileLocally(filePath);
  }
}

/**
 * Upload multiple images to Cloudinary
 */
export async function uploadMultipleImages(
  filePaths: string[],
  options: UploadOptions = {}
): Promise<UploadResult[]> {
  try {
    const uploadPromises = filePaths.map((filePath) =>
      uploadImage(filePath, options)
    );
    return await Promise.all(uploadPromises);
  } catch (error) {
    throw new Error(`Failed to upload multiple images: ${error}`);
  }
}

/**
 * Upload a document (PDF, image, etc.) to Cloudinary
 */
export async function uploadDocument(
  filePath: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.SELLER_DOCUMENTS,
      resource_type: options.resourceType || "raw",
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const result = await cloudinary.uploader.upload(filePath, uploadOptions);

    return {
      url: result.url,
      publicId: result.public_id,
      secureUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error: any) {
    console.warn("Cloudinary document upload failed, falling back to local storage:", error.message);
    return saveFileLocally(filePath);
  }
}

/**
 * Upload image from buffer (for multer)
 */
export async function uploadImageFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise(async (resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.PRODUCTS,
      resource_type: options.resourceType || "image",
      transformation: options.transformation,
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      async (error: any, result: any) => {
        if (error) {
          console.warn("Cloudinary buffer upload failed, falling back to local storage:", error.message);
          try {
            const localResult = await saveBufferLocally(buffer, "image");
            resolve(localResult);
          } catch (localErr) {
            reject(new Error(`Both Cloudinary and local buffer upload failed: ${localErr}`));
          }
        } else if (result) {
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary upload returned no result"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Upload document from buffer (for multer)
 */
export async function uploadDocumentFromBuffer(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return new Promise(async (resolve, reject) => {
    const uploadOptions = {
      folder: options.folder || CLOUDINARY_FOLDERS.SELLER_DOCUMENTS,
      resource_type: options.resourceType || "raw",
      overwrite: options.overwrite || false,
      invalidate: options.invalidate || true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      async (error: any, result: any) => {
        if (error) {
          console.warn("Cloudinary document buffer upload failed, falling back to local storage:", error.message);
          try {
            const localResult = await saveBufferLocally(buffer, options.resourceType || "raw");
            resolve(localResult);
          } catch (localErr) {
            reject(new Error(`Both Cloudinary and local document buffer upload failed: ${localErr}`));
          }
        } else if (result) {
          resolve({
            url: result.url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          reject(new Error("Cloudinary document upload returned no result"));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Delete an image from Cloudinary by public_id
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    if (publicId && publicId.startsWith("local-")) {
      ensureUploadsDir();
      const filename = publicId.replace("local-", "");
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    const deleteError = error as UploadApiErrorResponse;
    throw new Error(
      `Failed to delete image: ${deleteError.message || "Unknown error"}`
    );
  }
}

/**
 * Delete multiple images from Cloudinary
 */
export async function deleteMultipleImages(publicIds: string[]): Promise<void> {
  try {
    const localIds = publicIds.filter(id => id && id.startsWith("local-"));
    const remoteIds = publicIds.filter(id => !id || !id.startsWith("local-"));
    
    for (const id of localIds) {
      ensureUploadsDir();
      const filename = id.replace("local-", "");
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    if (remoteIds.length > 0) {
      await cloudinary.api.delete_resources(remoteIds);
    }
  } catch (error) {
    throw new Error(`Failed to delete multiple images: ${error}`);
  }
}
