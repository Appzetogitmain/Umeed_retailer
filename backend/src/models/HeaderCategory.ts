import mongoose, { Schema, Document } from 'mongoose';

export interface IHeaderCategory extends Document {
    headerCategoryId?: string;
    name: string;
    iconLibrary: string;
    iconName: string;
    slug: string;
    theme: string;
    relatedCategory?: string; // Links to a product category
    order: number;
    status: 'Published' | 'Unpublished';
    createdAt: Date;
    updatedAt: Date;
}

const HeaderCategorySchema: Schema = new Schema(
    {
        headerCategoryId: { type: String, unique: true, sparse: true },
        name: { type: String, required: true, unique: true },
        iconLibrary: { type: String, required: true },
        iconName: { type: String, required: true },
        slug: { type: String, required: true, unique: true },
        theme: { type: String, default: 'all' },
        relatedCategory: { type: String, required: false },
        order: { type: Number, default: 0 },
        status: { type: String, enum: ['Published', 'Unpublished'], default: 'Published' },
    },
    { timestamps: true }
);

// Pre-save middleware to auto-generate headerCategoryId if not provided
HeaderCategorySchema.pre("save", async function (next) {
  if (!this.headerCategoryId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'HDR-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.headerCategoryId = result;
  }
  next();
});

export default mongoose.model<IHeaderCategory>('HeaderCategory', HeaderCategorySchema);
