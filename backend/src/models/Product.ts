import mongoose, { Document, Schema } from "mongoose";

export interface IProduct extends Document {
  // Basic Info
  productId?: string;
  productName: string;
  smallDescription?: string;
  description?: string;

  // Categorization
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;
  subSubCategory?: mongoose.Types.ObjectId;
  headerCategoryId?: mongoose.Types.ObjectId;
  brand?: mongoose.Types.ObjectId;

  // Seller Info
  seller: mongoose.Types.ObjectId;

  // Images
  mainImage?: string;
  galleryImages: string[];

  // Pricing & Inventory
  price: number;
  discPrice?: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  barcode?: string;

  // Variations
  variationType?: string; // e.g., 'Size', 'Color', 'Weight'
  variations?: Array<{
    variationId?: string;
    name: string;
    value: string;
    price?: number;
    discPrice?: number;
    stock?: number;
    sku?: string;
    status?: string;
  }>;

  // Status Flags
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  status: "Active" | "Inactive" | "Pending" | "Rejected";

  // Product Details
  manufacturer?: string;
  madeIn?: string;
  tax?: mongoose.Types.ObjectId;
  fssaiLicNo?: string;
  totalAllowedQuantity?: number;

  // Return Policy
  isReturnable: boolean;
  maxReturnDays?: number;

  // SEO
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;

  // Details
  pack?: string;
  shelfLife?: string;
  marketer?: string;
  weight: number; // weight in kg

  // Ratings
  rating: number;
  reviewsCount: number;
  discount: number; // Calculated percentage

  returnPolicyText?: string;

  // Tags
  tags: string[];

  // Approval
  requiresApproval: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;

  // Commission
  commission?: number;

  // Shop by Store
  isShopByStoreOnly?: boolean;
  shopId?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    // Basic Info
    productId: {
      type: String,
      unique: true,
      sparse: true,
    },
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },
    smallDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Small description cannot exceed 500 characters"],
    },
    description: {
      type: String,
      trim: true,
    },

    // Categorization
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [
        function (this: any) {
          return !this.isShopByStoreOnly;
        },
        "Category is required",
      ],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    subSubCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
    },
    headerCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "HeaderCategory",
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },

    // Seller Info
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
    },

    // Images
    mainImage: {
      type: String,
      trim: true,
    },
    galleryImages: {
      type: [String],
      default: [],
    },

    // Pricing & Inventory
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },
    discPrice: {
      type: Number,
      default: 0,
      min: [0, "Discounted price cannot be negative"],
    },
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
    },
    stock: {
      type: Number,
      required: [true, "Stock is required"],
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
    sku: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    barcode: {
      type: String,
      trim: true,
    },

    // Variations
    variationType: {
      type: String,
      trim: true,
    },
    variations: {
      type: [
        {
          variationId: String,
          name: String,
          value: String,
          price: Number,
          discPrice: { type: Number, default: 0 },
          stock: Number,
          status: {
            type: String,
            enum: ["Available", "Sold out", "In stock"],
            default: "Available",
          },
          sku: String,
        },
      ],
      default: [],
    },

    // Status Flags
    publish: {
      type: Boolean,
      default: true,
    },
    popular: {
      type: Boolean,
      default: false,
    },
    dealOfDay: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending", "Rejected"],
      default: "Active",
    },

    // Product Details
    manufacturer: {
      type: String,
      trim: true,
    },
    madeIn: {
      type: String,
      trim: true,
    },
    weight: {
      type: Number,
      required: [true, "Weight (in kg) is required"],
      min: [0, "Weight cannot be negative"],
      default: 0
    },
    tax: {
      type: Schema.Types.ObjectId,
      ref: "Tax",
    },
    fssaiLicNo: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          return /^FSSAI Lic\. No\. \d{14}$/.test(v);
        },
        message: "FSSAI License Number must be in the format 'FSSAI Lic. No. [14 digits]'"
      }
    },
    totalAllowedQuantity: {
      type: Number,
      min: [0, "Total allowed quantity cannot be negative"],
    },

    // Return Policy
    isReturnable: {
      type: Boolean,
      default: false,
    },
    maxReturnDays: {
      type: Number,
      min: [0, "Max return days cannot be negative"],
    },

    // SEO
    seoTitle: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    seoImageAlt: {
      type: String,
      trim: true,
    },

    // Details
    pack: { type: String, trim: true },
    shelfLife: { type: String, trim: true },
    marketer: { type: String, trim: true },

    // Ratings
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },

    returnPolicyText: { type: String, trim: true },

    // Tags
    tags: {
      type: [String],
      default: [],
    },

    // Approval (removed - all products are auto-published)
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    approvedAt: {
      type: Date,
    },

    // Commission
    commission: {
      type: Number,
      min: [0, "Commission cannot be negative"],
    },

    // Shop by Store
    isShopByStoreOnly: {
      type: Boolean,
      default: false,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for mrp (alias for compareAtPrice to match frontend)
ProductSchema.virtual("mrp").get(function () {
  return this.compareAtPrice;
});

// Calculate discount and sync stock/price from variations before saving
ProductSchema.pre("save", function (next) {
  // Generate short IDs if they don't exist
  if (!this.productId) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'PRD-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.productId = result;
  }

  // Sync price and stock from variations if they exist
  if (this.variations && this.variations.length > 0) {
    this.variations.forEach(variation => {
      if (!variation.variationId) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = 'VAR-';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        variation.variationId = result;
      }
    });

    // Set price to the price of the first variation if top-level price is not set or if we want to keep it in sync
    if (this.variations[0].price !== undefined) {
      this.price = this.variations[0].price;
    }

    // Calculate total stock as sum of all variation stocks
    this.stock = this.variations.reduce(
      (acc: number, curr: any) => acc + (Number(curr.stock) || 0),
      0
    );
  }

  // Calculate discount
  if (this.compareAtPrice && this.compareAtPrice > this.price) {
    this.discount = Math.round(
      ((this.compareAtPrice - this.price) / this.compareAtPrice) * 100
    );
  } else {
    this.discount = 0;
  }
  next();
});

// Indexes for faster queries
ProductSchema.index({ seller: 1, status: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ subcategory: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ publish: 1 });
// Compound indexes for common queries
ProductSchema.index({ status: 1, publish: 1 }); // For getProducts
ProductSchema.index({ category: 1, status: 1, publish: 1 }); // For category products
ProductSchema.index({ subcategory: 1, status: 1, publish: 1 }); // For subcategory products
ProductSchema.index({
  productName: "text",
  smallDescription: "text",
  description: "text",
  tags: "text",
  pack: "text",
});

const Product = mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
