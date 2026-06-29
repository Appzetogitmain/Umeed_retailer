import api from './config';

export interface Review {
    _id: string;
    product: string;
    customer: {
        _id: string;
        name: string;
    };
    rating: number;
    comment: string;
    createdAt: string;
}

export interface ReviewResponse {
    success: boolean;
    data: {
        reviews: Review[];
        stats: {
            avgRating: number;
            totalReviews: number;
        };
        pagination: any;
    };
    message?: string;
}

/**
 * Get reviews for a product
 */
export const getProductReviews = async (productId: string): Promise<ReviewResponse> => {
    const response = await api.get<ReviewResponse>(`/customer/reviews/${productId}`);
    return response.data;
};

/**
 * Add a review for a product
 */
export const addReview = async (productId: string, orderId: string, rating: number, comment: string, title?: string): Promise<any> => {
    const response = await api.post('/customer/reviews', { productId, orderId, rating, comment, title });
    return response.data;
};
