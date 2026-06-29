import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  product: mongoose.Types.ObjectId;
  order: mongoose.Types.ObjectId;
  customer: mongoose.Types.ObjectId;

  // Review Content
  rating: number; // 1-5
  title?: string;
  comment?: string;
  images?: string[];

  // Status
  status: "Pending" | "Approved" | "Rejected";
  isVerifiedPurchase: boolean;

  // Helpful
  helpfulCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer is required"],
    },

    // Review Content
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
    },
    title: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },

    // Helpful
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, "Helpful count cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReviewSchema.index({ product: 1, status: 1 });
ReviewSchema.index({ customer: 1 });
ReviewSchema.index({ order: 1 });

// Static method to get avg rating and update product
ReviewSchema.statics.calcAverageRatings = async function (productId: mongoose.Types.ObjectId) {
  const stats = await this.aggregate([
    {
      $match: { product: productId }
    },
    {
      $group: {
        _id: '$product',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      reviewsCount: stats[0].nRating,
      rating: Math.round(stats[0].avgRating * 10) / 10
    });
  } else {
    await mongoose.model('Product').findByIdAndUpdate(productId, {
      reviewsCount: 0,
      rating: 0
    });
  }
};

// Call calcAverageRatings after save
ReviewSchema.post('save', function () {
  (this.constructor as any).calcAverageRatings(this.product);
});

// Call calcAverageRatings after update/delete
ReviewSchema.post(/^findOneAnd/, async function (doc) {
  if (doc) {
    await (doc.constructor as any).calcAverageRatings(doc.product);
  }
});

interface IReviewModel extends mongoose.Model<IReview> {
  calcAverageRatings(productId: mongoose.Types.ObjectId): Promise<void>;
}

const Review = mongoose.model<IReview, IReviewModel>("Review", ReviewSchema);

export default Review;
