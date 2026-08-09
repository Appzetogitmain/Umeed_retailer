import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  keyValue?: Record<string, any>;
  name: string;
}

export const errorHandler = async (
  err: CustomError,
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  // Log error for debugging
  console.error('Error:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    message = 'Duplicate field value entered';
    if (err.keyValue) {
      const field = Object.keys(err.keyValue)[0];
      const value = err.keyValue[field];
      message = `Duplicate value for field: ${field}`;

      // Special handling for Category Name
      if (field === 'name' && err.message && err.message.includes('categories')) {
        try {
          const Category = mongoose.model('Category');
          const existingCategory = await Category.findOne({ name: value });
          if (existingCategory) {
             if (existingCategory.parentId) {
               const parent = await Category.findById(existingCategory.parentId);
               if (parent && parent.parentId) {
                 message = `'${value}' already exists as a Sub-SubCategory! Please use a different name.`;
               } else {
                 message = `'${value}' already exists as a Sub-Category! Please use a different name.`;
               }
             } else {
               message = `'${value}' already exists as a Main Category! Please use a different name.`;
             }
          }
        } catch (e) {
           console.error("Error looking up duplicate category:", e);
           // Ignore error and stick to default message
        }
      }
    }
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Resource not found';
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // content of message is usually sufficient
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: {
      statusCode,
      ... (process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
};








