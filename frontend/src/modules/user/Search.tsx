import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductCard from './components/ProductCard';
import { getProducts } from '../../services/api/customerProductService';
import { getHomeContent } from '../../services/api/customerHomeService';
import { Product } from '../../types/domain';
import { useLocation } from '../../hooks/useLocation';

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { location } = useLocation();
  const searchQuery = searchParams.get('q') || '';

  // Sanitize query to ignore leading/trailing and redundant internal spaces
  const sanitizedQuery = useMemo(() => {
    return searchQuery.trim().replace(/\s+/g, ' ');
  }, [searchQuery]);

  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [cookingIdeas, setCookingIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [contentLoading, setContentLoading] = useState(true);

  // Fetch products based on search query
  useEffect(() => {
    const fetchProducts = async () => {
      if (!sanitizedQuery) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const params: any = { search: sanitizedQuery };
        // Include user location for seller service radius filtering
        if (location?.latitude && location?.longitude) {
          params.latitude = location.latitude;
          params.longitude = location.longitude;
        }
        const response = await getProducts(params);
        setSearchResults(response.data as unknown as Product[]);
      } catch (error) {
        console.error('Error searching products:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [sanitizedQuery, location]);

  // Fetch trending/home content for initial view
  useEffect(() => {
    const fetchInitialContent = async () => {
      try {
        const response = await getHomeContent(
          undefined,
          location?.latitude,
          location?.longitude
        );
        if (response.success && response.data) {
          setTrendingItems(response.data.trending || []);
          setCookingIdeas(response.data.cookingIdeas || []);
        }
      } catch (error) {
        console.error("Error fetching search initial content", error);
      } finally {
        setContentLoading(false);
      }
    };

    if (!sanitizedQuery) {
      fetchInitialContent();
    }
  }, [sanitizedQuery, location?.latitude, location?.longitude]);

  return (
    <div className="pb-24 md:pb-8 bg-white min-h-screen">

      {/* Search Results */}
      {sanitizedQuery && (
        <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
          <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">
            Search Results {searchResults.length > 0 && `(${searchResults.length})`}
          </h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A3E8E]"></div>
            </div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {searchResults.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryStyle={true}
                  showBadge={true}
                  showPackBadge={false}
                  showStockInfo={true}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 md:px-6 lg:px-8 py-16 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-neutral-50 border border-neutral-100 rounded-full flex items-center justify-center mb-3 shadow-inner animate-pulse">
                <span className="text-2xl">🔍</span>
              </div>
              <p className="text-neutral-800 font-semibold md:text-lg">
                No products found in your area
              </p>
              <p className="text-neutral-500 text-sm mt-1 max-w-xs">
                We couldn't find "{sanitizedQuery}" delivering close to you. Try a different search term or check your location.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trending in your city */}
      {!sanitizedQuery && (
        <>
          {contentLoading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A3E8E]"></div>
            </div>
          )}

          {!contentLoading && trendingItems.length > 0 && (
            <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
              <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">Trending in your city</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
                {trendingItems.map((item) => (
                  <div
                    key={item.id || item._id}
                    className="bg-white rounded-xl border border-neutral-200 hover:border-[#7A3E8E] hover:border-2 p-3.5 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5"
                    onClick={() => navigate(item.type === 'category' ? `/category/${item.id || item._id}` : `/product/${item.id || item._id}`)}
                  >
                    <div className="w-full h-24 rounded-lg mb-2 overflow-hidden bg-neutral-50 flex items-center justify-center">
                      {item.image || item.imageUrl ? (
                        <img
                          src={item.image || item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-contain bg-white rounded-sm"
                        />
                      ) : (
                        <div className="text-4xl">🔥</div>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-neutral-900 text-center line-clamp-2">
                      {item.name || item.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* See all products - Placeholder or link to popular items */}
          <div className="px-4 md:px-6 lg:px-8 py-2 md:py-4">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 cursor-pointer" onClick={() => navigate('/category/all')}>
              <span className="text-sm md:text-base text-neutral-700 font-medium whitespace-nowrap">Browse all categories ▸</span>
            </div>
          </div>

          {/* Cooking ideas */}
          {!contentLoading && cookingIdeas.length > 0 && (
            <div className="px-4 md:px-6 lg:px-8 py-4 md:py-6">
              <h2 className="text-lg md:text-2xl font-semibold text-neutral-900 mb-3 md:mb-6">Cooking ideas</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                {cookingIdeas.map((idea, idx) => (
                  <div key={idea.id || idea._id || idx} className="relative rounded-lg overflow-hidden aspect-[4/3] bg-neutral-100 cursor-pointer" onClick={() => navigate(`/product/${idea.productId || idea.id}`)}>
                    {idea.image && <img src={idea.image} alt={idea.title} className="w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                    <div className="absolute bottom-2 left-2 right-2 text-white text-xs font-bold line-clamp-2">{idea.title}</div>
                    <button className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
