import { Router, Request, Response } from "express";
import { authenticate, requireUserType } from "../middleware/auth";
import {
  uploadSingleImage,
  uploadMultipleImages,
  uploadDocument,
  uploadMultipleDocuments,
  handleUploadError,
} from "../middleware/upload";
import {
  uploadImageFromBuffer,
  uploadDocumentFromBuffer,
  deleteImage,
  validateImageBuffer,
  IMAGE_FOLDERS,
} from "../services/imageService";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Routes that require authentication
router.post(
  "/image",
  authenticate,
  requireUserType("Admin", "Seller"),
  uploadSingleImage.single("image"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    let folder = (req.body.folder as string) || IMAGE_FOLDERS.PRODUCTS;
    folder = folder.replace(/\\/g, '/');
    if (folder.includes('/')) {
        folder = folder.split('/').pop() || IMAGE_FOLDERS.PRODUCTS;
    }
    if (folder === 'gallery' || folder === 'Speedoo') {
        folder = 'products';
    }
    
    let maxBytes = 10 * 1024 * 1024; // 10MB default
    if (folder === IMAGE_FOLDERS.BANNERS) maxBytes = 15 * 1024 * 1024;
    else if (folder === IMAGE_FOLDERS.CATEGORIES || folder === IMAGE_FOLDERS.SELLERS) maxBytes = 5 * 1024 * 1024;
    
    await validateImageBuffer((req as any).file.buffer, (req as any).file.mimetype, maxBytes);

    const result = await uploadImageFromBuffer((req as any).file.buffer, {
      folder,
      resourceType: "image",
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

router.post(
  "/images",
  authenticate,
  requireUserType("Admin", "Seller"),
  uploadMultipleImages.array("images", 10), // Max 10 images
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided",
      });
    }

    let folder = (req.body.folder as string) || IMAGE_FOLDERS.PRODUCTS;
    folder = folder.replace(/\\/g, '/');
    if (folder.includes('/')) {
        folder = folder.split('/').pop() || IMAGE_FOLDERS.PRODUCTS;
    }
    if (folder === 'gallery' || folder === 'Speedoo') {
        folder = 'products';
    }
    const files = (req as any).files as any[];
    
    let maxBytes = 10 * 1024 * 1024; // 10MB default
    if (folder === IMAGE_FOLDERS.BANNERS) maxBytes = 15 * 1024 * 1024;
    else if (folder === IMAGE_FOLDERS.CATEGORIES || folder === IMAGE_FOLDERS.SELLERS) maxBytes = 5 * 1024 * 1024;

    for (const file of files) {
        await validateImageBuffer(file.buffer, file.mimetype, maxBytes);
    }

    const uploadPromises = files.map((file) =>
      uploadImageFromBuffer(file.buffer, {
        folder,
        resourceType: "image",
      })
    );

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * POST /api/v1/upload/document
 * Upload a document (image or PDF) - PUBLIC for signup
 */
router.post(
  "/document",
  uploadDocument.single("document"),
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).file) {
      return res.status(400).json({
        success: false,
        message: "No document file provided",
      });
    }

    // Determine folder based on user type if authenticated, otherwise default to delivery
    let folder: string = IMAGE_FOLDERS.DELIVERY_DOCUMENTS;
    const userType = (req as any).user?.userType;

    if (userType === "Seller") {
      folder = IMAGE_FOLDERS.SELLER_DOCUMENTS;
    }
    
    await validateImageBuffer((req as any).file.buffer, (req as any).file.mimetype, 10 * 1024 * 1024);

    // Check if it's an image or PDF
    const isImage = (req as any).file.mimetype.startsWith("image/");
    const resourceType = isImage ? "image" : "raw";

    const result = await uploadDocumentFromBuffer((req as any).file.buffer, {
      folder,
      resourceType,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/upload/documents
 * Upload multiple documents - PUBLIC for signup
 */
router.post(
  "/documents",
  uploadMultipleDocuments.array("documents", 5), // Max 5 documents
  handleUploadError,
  asyncHandler(async (req: Request, res: Response) => {
    if (!(req as any).files || ((req as any).files as any[]).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No document files provided",
      });
    }

    // Determine folder
    let folder: string = IMAGE_FOLDERS.DELIVERY_DOCUMENTS;
    const userType = (req as any).user?.userType;

    if (userType === "Seller") {
      folder = IMAGE_FOLDERS.SELLER_DOCUMENTS;
    }

    const files = (req as any).files as any[];
    
    for (const file of files) {
        await validateImageBuffer(file.buffer, file.mimetype, 10 * 1024 * 1024);
    }

    const uploadPromises = files.map((file) => {
      const isImage = file.mimetype.startsWith("image/");
      const resourceType = isImage ? "image" : "raw";
      return uploadDocumentFromBuffer(file.buffer, {
        folder,
        resourceType,
      });
    });

    const results = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * DELETE /api/v1/upload/:publicId
 * Delete an image from Cloudinary
 */
router.delete(
  "/:publicId",
  authenticate,
  requireUserType("Admin", "Seller"),
  asyncHandler(async (req: Request, res: Response) => {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    await deleteImage(publicId);

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  })
);

export default router;
