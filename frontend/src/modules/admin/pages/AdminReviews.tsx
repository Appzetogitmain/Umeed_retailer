import { useState, useEffect } from "react";
import { normalizeImageUrl } from "../../../utils/imageUrl";
import { getAllReviews, updateReviewStatus, deleteReview, Review } from "../../../services/api/adminReviewService";

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");

  useEffect(() => {
    fetchReviews();
  }, [filter]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = filter !== "All" ? { status: filter } : {};
      const res = await getAllReviews(params);
      if (res.success) {
        setReviews(res.data.reviews);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: "Pending" | "Approved" | "Rejected") => {
    try {
      await updateReviewStatus(id, status);
      fetchReviews(); // refresh
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to update review status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await deleteReview(id);
      fetchReviews(); // refresh
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to delete review");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-green-50 text-green-700 border-green-200";
      case "Rejected":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => window.history.back()} className="p-1 sm:p-2 text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors" aria-label="Go back">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Ratings & Reviews</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Manage product reviews submitted by customers</p>
        </div>
        
        <div className="flex gap-2 bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          {["All", "Pending", "Approved", "Rejected"].map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                filter === opt 
                  ? "bg-[#f57c00] text-white shadow" 
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Product</th>
                <th className="px-6 py-4">Seller</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4 w-1/3">Comment</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading reviews...
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No reviews found for this filter.
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{review.customer?.name || "Unknown"}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{review.customer?.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {review.product?.mainImage && (
                          <img src={normalizeImageUrl(review.product.mainImage)} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                        )}
                        <div>
                          <span className="font-medium text-gray-900 line-clamp-2 max-w-[200px]">
                            {review.product?.productName || "Unknown Product"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {review.product?.seller ? (
                        <div>
                          <div className="font-medium text-gray-900">{review.product.seller.storeName || "Store"}</div>
                          <div className="text-gray-500 text-xs mt-0.5">{review.product.seller.sellerName}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Unknown</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 bg-yellow-50 w-fit px-2 py-1 rounded border border-yellow-100">
                        <span className="text-yellow-600 font-bold">{review.rating}</span>
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {review.title && <div className="font-semibold text-gray-900 mb-1">{review.title}</div>}
                      <p className="text-gray-600 line-clamp-3 text-sm">{review.comment || <span className="text-gray-400 italic">No comment provided</span>}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(review.status)}`}>
                        {review.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {review.status !== "Approved" && (
                          <button
                            onClick={() => handleStatusChange(review._id, "Approved")}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors tooltip-trigger"
                            title="Approve"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        )}
                        {review.status !== "Rejected" && (
                          <button
                            onClick={() => handleStatusChange(review._id, "Rejected")}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors tooltip-trigger"
                            title="Reject"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(review._id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2 border-l border-gray-200 pl-3"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
