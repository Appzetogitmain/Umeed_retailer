import api from "./config";

export interface Review {
  _id: string;
  product: {
    _id: string;
    productName: string;
    mainImage?: string;
    seller?: {
      _id: string;
      sellerName: string;
      storeName?: string;
    };
  };
  customer: {
    _id: string;
    name: string;
    phone: string;
    email?: string;
  };
  rating: number;
  title?: string;
  comment?: string;
  status: "Pending" | "Approved" | "Rejected";
  createdAt: string;
}

export interface GetReviewsResponse {
  success: boolean;
  data: {
    reviews: Review[];
    pagination: {
      total: number;
      page: number;
      pages: number;
    };
  };
}

export const getAllReviews = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<GetReviewsResponse> => {
  const response = await api.get("/admin/reviews", { params });
  return response.data;
};

export const updateReviewStatus = async (id: string, status: "Pending" | "Approved" | "Rejected") => {
  const response = await api.patch(`/admin/reviews/${id}/status`, { status });
  return response.data;
};

export const deleteReview = async (id: string) => {
  const response = await api.delete(`/admin/reviews/${id}`);
  return response.data;
};
