import multer from "multer";
import { Request } from "express";

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_DOCUMENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const ALLOWED_BULK_TYPES = [
  // .xlsx (Excel 2007+)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  // .xls (old Excel) — some OS / browsers report this for .xlsx too
  "application/vnd.ms-excel",
  // .zip variants — different OS/browsers send different MIME types
  "application/zip",
  "application/x-zip",
  "application/x-zip-compressed",
  "application/octet-stream",   // generic binary — Chrome/Windows often sends this for .zip
  "multipart/x-zip",
  "application/x-compressed",
];

// Memory storage for multer (files will be stored in memory as buffers)
const storage = multer.memoryStorage();

// File filter for images
const imageFileFilter = (
  _req: Request,
  file: any,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
      )
    );
  }
};

// File filter for documents (images + PDF)
const documentFileFilter = (
  _req: Request,
  file: any,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${ALLOWED_DOCUMENT_TYPES.join(", ")}`
      )
    );
  }
};

// File filter for bulk upload files (Excel and Zip)
const bulkFileFilter = (
  _req: Request,
  file: any,
  cb: multer.FileFilterCallback
) => {
  const mimeOk = ALLOWED_BULK_TYPES.includes(file.mimetype);
  // Extension-based fallback — browsers on different OSes send different MIME types for the same file
  const extOk = /\.(xlsx|xls|zip)$/i.test(file.originalname);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type '${file.mimetype}'. Please upload an Excel (.xlsx) or ZIP (.zip) file.`
      )
    );
  }
};

// Multer instance for single image upload
export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
  fileFilter: imageFileFilter,
});

// Multer instance for multiple image uploads
export const uploadMultipleImages = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE,
  },
  fileFilter: imageFileFilter,
});

// Multer instance for document upload (image or PDF)
export const uploadDocument = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
  },
  fileFilter: documentFileFilter,
});

// Multer instance for multiple documents
export const uploadMultipleDocuments = multer({
  storage,
  limits: {
    fileSize: MAX_DOCUMENT_SIZE,
  },
  fileFilter: documentFileFilter,
});

// Multer instance for bulk uploads
export const uploadBulkFiles = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB for zip files
  },
  fileFilter: bulkFileFilter,
});

// Error handler middleware for multer errors
export const handleUploadError = (
  err: any,
  _req: Request,
  res: any,
  _next: any
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size exceeds the maximum allowed limit",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected file field",
      });
    }
  }

  if (err.message && err.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  _next(err);
};
