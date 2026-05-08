import mongoose, { Document, Schema } from "mongoose";

export interface IPolicy extends Document {
    type: "customer" | "delivery";
    title: string;
    content: string;
    version: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const PolicySchema = new Schema<IPolicy>(
    {
        type: {
            type: String,
            enum: [
                "customer", 
                "delivery", 
                "privacy_policy", 
                "terms_and_conditions", 
                "about_us", 
                "rider_about_us", 
                "seller_privacy_policy", 
                "seller_terms_and_conditions",
                "delivery_privacy_policy",
                "delivery_terms_and_conditions"
            ],
            required: [true, "Policy type is required"],
        },
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
        },
        content: {
            type: String,
            required: [true, "Content is required"],
        },
        version: {
            type: String,
            required: [true, "Version is required"],
            trim: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

// Ensure only one active policy per type if needed, but for now allow multiple and filter by active
// Or maybe unique compound index if we want unique versions?
// Leaving standard for now.

const Policy = mongoose.model<IPolicy>("Policy", PolicySchema);

export default Policy;
