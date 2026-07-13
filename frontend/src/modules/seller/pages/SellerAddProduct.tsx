import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadImage, uploadImages } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";
import {
  createProduct,
  updateProduct,
  getProductById,
  getShops,
  ProductVariation,
  Shop,
} from "../../../services/api/productService";
import {
  updateProduct as adminUpdateProduct,
  getProductById as adminGetProductById,
  getBrands as adminGetBrands,
} from "../../../services/api/admin/adminProductService";
import {
  getCategories,
  getSubcategories,
  getSubSubCategories,
  Category,
  SubCategory,
  SubSubCategory,
} from "../../../services/api/categoryService";
import { getActiveTaxes, Tax } from "../../../services/api/taxService";
import { getBrands, Brand } from "../../../services/api/brandService";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

export default function SellerAddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isAdmin = window.location.pathname.includes('/admin');
  const [formData, setFormData] = useState({
    productName: "",
    headerCategory: "",
    category: "",
    subcategory: "",
    subSubCategory: "",
    publish: "No",
    brand: "",
    tags: "",
    smallDescription: "",
    seoTitle: "",
    seoKeywords: "",
    seoImageAlt: "",
    seoDescription: "",
    variationType: "",
    manufacturer: "",
    madeIn: "",
    tax: "",
    isReturnable: "No",
    maxReturnDays: "",
    fssaiLicNo: "",
    totalAllowedQuantity: "10",
    mainImageUrl: "",
    galleryImageUrls: [] as string[],
    isShopByStoreOnly: "No",
    shopId: "",
  });

  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [variationForm, setVariationForm] = useState({
    title: "",
    price: "",
    discPrice: "0",
    stock: "0",
    status: "Available" as "Available" | "Sold out",
  });
  const [editVariationIndex, setEditVariationIndex] = useState<number | null>(null);

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<string[]>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>(
    []
  );
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>(
    []
  );
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const fetchBrandsFn = isAdmin ? adminGetBrands : getBrands;
        // Use Promise.allSettled to ensure one failing API doesn't break all others
        const results = await Promise.allSettled([
          getCategories(),
          getActiveTaxes(),
          fetchBrandsFn(),
          getHeaderCategoriesPublic(),
          getShops(),
        ]);

        // Handle categories
        if (results[0].status === "fulfilled" && results[0].value.success) {
          setCategories(results[0].value.data);
        }

        // Handle taxes
        if (results[1].status === "fulfilled" && results[1].value.success) {
          setTaxes(results[1].value.data);
        }

        // Handle brands
        if (results[2].status === "fulfilled" && results[2].value.success) {
          setBrands(results[2].value.data);
        }

        // Handle header categories
        if (results[3].status === "fulfilled") {
          const headerCatRes = results[3].value;
          if (headerCatRes && Array.isArray(headerCatRes)) {
            // Filter only Published header categories
            const published = headerCatRes.filter(
              (hc: HeaderCategory) => hc.status === "Published"
            );
            setHeaderCategories(published);
          }
        }

        // Handle shops (optional - for Shop By Store feature)
        if (results[4].status === "fulfilled" && results[4].value.success) {
          setShops(results[4].value.data);
        } else if (results[4].status === "rejected") {
          // Shops API failed - this is non-critical, log and continue
          console.warn(
            "Failed to fetch shops (Shop By Store feature may be unavailable):",
            results[4].reason?.message || "Unknown error"
          );
        }
      } catch (err) {
        console.error("Error fetching form data:", err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchProduct = async () => {
        try {
          const fetchFn = isAdmin ? adminGetProductById : getProductById;
          const response = await fetchFn(id);
          if (response.success && response.data) {
            const product = response.data as any;
            setFormData({
              productName: product.productName,
              headerCategory:
                (product.headerCategoryId as any)?._id ||
                (product as any).headerCategoryId ||
                (product.headerCategory as any)?._id ||
                product.headerCategory ||
                "",
              category:
                (product.category as any)?._id || product.categoryId || product.category || "",
              subcategory:
                (product.subcategory as any)?._id ||
                product.subcategoryId ||
                product.subcategory ||
                "",
              subSubCategory:
                (product.subSubCategory as any)?._id ||
                (product as any).subSubCategoryId ||
                product.subSubCategory ||
                "",
              publish: product.publish ? "Yes" : "No",
              brand: (product.brand as any)?._id || product.brandId || "",
              tags: product.tags.join(", "),
              smallDescription: product.smallDescription || "",
              seoTitle: product.seoTitle || "",
              seoKeywords: product.seoKeywords || "",
              seoImageAlt: product.seoImageAlt || "",
              seoDescription: product.seoDescription || "",
              variationType: product.variationType || "",
              manufacturer: product.manufacturer || "",
              madeIn: product.madeIn || "",
              tax: (product.tax as any)?._id || product.taxId || (typeof product.tax === 'string' ? product.tax : ""),
              isReturnable: product.isReturnable ? "Yes" : "No",
              maxReturnDays: product.maxReturnDays?.toString() || "",
              fssaiLicNo: product.fssaiLicNo ? product.fssaiLicNo.replace('FSSAI Lic. No. ', '') : "",
              totalAllowedQuantity:
                product.totalAllowedQuantity?.toString() || "10",
              mainImageUrl: product.mainImageUrl || product.mainImage || "",
              galleryImageUrls: product.galleryImageUrls || [],
              isShopByStoreOnly: (product as any).isShopByStoreOnly
                ? "Yes"
                : "No",
              shopId:
                (product as any).shopId?._id || (product as any).shopId || "",
            });
            setVariations(product.variations);
            if (product.mainImageUrl || product.mainImage) {
              setMainImagePreview(
                product.mainImageUrl || product.mainImage || ""
              );
            }
            if (product.galleryImageUrls) {
              setGalleryImagePreviews(product.galleryImageUrls);
            }
          }
        } catch (err) {
          console.error("Error fetching product:", err);
          setUploadError("Failed to fetch product details");
        }
      };
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const res = await getSubcategories(formData.category);
        if (res.success) setSubcategories(res.data);
      } catch (err) {
        console.error("Error fetching subcategories:", err);
      }
    };
    if (formData.category) {
      fetchSubs();
    } else {
      setSubcategories([]);
    }
  }, [formData.category]);

  useEffect(() => {
    const fetchSubSubs = async () => {
      try {
        const res = await getSubSubCategories(formData.subcategory);
        if (res.success) setSubSubCategories(res.data);
      } catch (err) {
        console.error("Error fetching sub-subcategories:", err);
      }
    };
    if (formData.subcategory) {
      fetchSubSubs();
    } else {
      setSubSubCategories([]);
    }
  }, [formData.subcategory]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updates = { ...prev, [name]: value };
      
      // Clear dependent fields when a parent category changes
      if (name === "headerCategory") {
        updates.category = "";
        updates.subcategory = "";
        updates.subSubCategory = "";
      } else if (name === "category") {
        updates.subcategory = "";
        updates.subSubCategory = "";
      } else if (name === "subcategory") {
        updates.subSubCategory = "";
      }
      
      return updates;
    });
  };

  const handleMainImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setMainImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setMainImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const handleGalleryImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate all files
    const invalidFiles = files.filter((file) => !validateImageFile(file).valid);
    if (invalidFiles.length > 0) {
      setUploadError(
        "Some files are invalid. Please check file types and sizes."
      );
      return;
    }

    setGalleryImageFiles(files);
    setUploadError("");

    try {
      const previews = await Promise.all(
        files.map((file) => createImagePreview(file))
      );
      setGalleryImagePreviews(previews);
    } catch (error) {
      setUploadError("Failed to create image previews");
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImageFiles((prev) => prev.filter((_, i) => i !== index));
    setGalleryImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariationNumberChange = (field: keyof typeof variationForm, value: string) => {
    // Remove leading zeros followed by a digit (e.g., "05" -> "5", "00" -> "0")
    let cleaned = value.replace(/^0+(?=\d)/, '');
    setVariationForm(prev => ({ ...prev, [field]: cleaned }));
  };

  const addVariation = () => {
    if (!variationForm.title || !variationForm.price) {
      setUploadError("Please fill in variation title and price");
      return;
    }

    const price = parseFloat(variationForm.price);
    const discPrice = parseFloat(variationForm.discPrice || "0");
    const stock = parseInt(variationForm.stock || "0");

    if (discPrice > price) {
      setUploadError("Discounted price cannot be greater than price");
      return;
    }

    const newVariation: ProductVariation = {
      ...(editVariationIndex !== null && variations[editVariationIndex]?._id
        ? { _id: variations[editVariationIndex]._id }
        : {}),
      title: variationForm.title,
      price,
      discPrice,
      stock,
      status: variationForm.status,
    };

    if (editVariationIndex !== null) {
      const updatedVariations = [...variations];
      updatedVariations[editVariationIndex] = newVariation;
      setVariations(updatedVariations);
      setEditVariationIndex(null);
    } else {
      setVariations([...variations, newVariation]);
    }

    setVariationForm({
      title: "",
      price: "",
      discPrice: "0",
      stock: "0",
      status: "Available",
    });
    setUploadError("");
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
    if (editVariationIndex === index) {
      setEditVariationIndex(null);
      setVariationForm({
        title: "",
        price: "",
        discPrice: "0",
        stock: "0",
        status: "Available",
      });
    }
  };

  const editVariation = (index: number) => {
    setEditVariationIndex(index);
    const variation = variations[index];
    setVariationForm({
      title: variation.title || "",
      price: (variation.price || 0).toString(),
      discPrice: (variation.discPrice || 0).toString(),
      stock: (variation.stock || 0).toString(),
      status: (variation.status as "Available" | "Sold out") || "Available",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    // Basic validation
    if (!formData.productName.trim()) {
      setUploadError("Please enter a product name.");
      return;
    }

    // Only validate categories if NOT shop by store only
    if (formData.isShopByStoreOnly !== "Yes") {
      if (!formData.headerCategory) {
        setUploadError("Please select a header category.");
        return;
      }
      if (!formData.category) {
        setUploadError("Please select a category.");
        return;
      }
    }

    if (formData.fssaiLicNo && formData.fssaiLicNo.length !== 14) {
      setUploadError("FSSAI License Number must be exactly 14 digits.");
      return;
    }

    setUploading(true);

    try {
      // Keep local copies so we don't rely on async state updates before submit
      let mainImageUrl = formData.mainImageUrl;
      let galleryImageUrls = [...formData.galleryImageUrls];

      // Upload main image if provided
      if (mainImageFile) {
        const mainImageResult = await uploadImage(
          mainImageFile,
          "Speedoo/products"
        );
        mainImageUrl = mainImageResult.secureUrl;
        setFormData((prev) => ({
          ...prev,
          mainImageUrl,
        }));
      }

      // Upload gallery images if provided
      if (galleryImageFiles.length > 0) {
        const galleryResults = await uploadImages(
          galleryImageFiles,
          "Speedoo/products/gallery"
        );
        galleryImageUrls = galleryResults.map((result) => result.secureUrl);
        setFormData((prev) => ({ ...prev, galleryImageUrls }));
      }

      // Validate variations
      if (variations.length === 0) {
        setUploadError("Please add at least one product variation");
        setUploading(false);
        return;
      }

      // Prepare product data for API
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const productData = {
        productName: formData.productName,
        headerCategoryId: formData.headerCategory || null,
        categoryId: formData.category || null,
        subcategoryId: formData.subcategory || null,
        subSubCategoryId: formData.subSubCategory || null,
        brandId: formData.brand || null,
        publish: formData.publish === "Yes",
        seoTitle: formData.seoTitle || undefined,
        seoKeywords: formData.seoKeywords || undefined,
        seoImageAlt: formData.seoImageAlt || undefined,
        seoDescription: formData.seoDescription || undefined,
        smallDescription: formData.smallDescription || undefined,
        tags: tagsArray,
        manufacturer: formData.manufacturer || undefined,
        madeIn: formData.madeIn || undefined,
        taxId: formData.tax || undefined,
        isReturnable: formData.isReturnable === "Yes",
        maxReturnDays: formData.maxReturnDays
          ? parseInt(formData.maxReturnDays)
          : undefined,
        totalAllowedQuantity: parseInt(formData.totalAllowedQuantity || "10"),
        fssaiLicNo: formData.fssaiLicNo ? `FSSAI Lic. No. ${formData.fssaiLicNo}` : undefined,
        mainImageUrl: mainImageUrl || undefined,
        galleryImageUrls,
        variations: variations,
        variationType: formData.variationType || undefined,
        isShopByStoreOnly: formData.isShopByStoreOnly === "Yes",
        shopId:
          formData.isShopByStoreOnly === "Yes" && formData.shopId
            ? formData.shopId
            : undefined,
      };

      // Create or Update product via API
      let response;
      if (id) {
        const updateFn = isAdmin ? adminUpdateProduct : updateProduct;
        response = await updateFn(id as string, productData as any);
      } else {
        response = await createProduct(productData as any);
      }

      if (response.success) {
        setSuccessMessage(
          id ? "Product updated successfully!" : "Product added successfully!"
        );
        setTimeout(() => {
          // Reset form or navigate
          if (!id) {
            setFormData({
              productName: "",
              headerCategory: "",
              category: "",
              subcategory: "",
              subSubCategory: "",
              publish: "No",
              brand: "",
              tags: "",
              smallDescription: "",
              seoTitle: "",
              seoKeywords: "",
              seoImageAlt: "",
              seoDescription: "",
              variationType: "",
              manufacturer: "",
              madeIn: "",
              tax: "",
              isReturnable: "No",
              maxReturnDays: "",
              fssaiLicNo: "",
              totalAllowedQuantity: "10",
              mainImageUrl: "",
              galleryImageUrls: [],
              isShopByStoreOnly: "No",
              shopId: "",
            });
            setVariations([]);
            setMainImageFile(null);
            setMainImagePreview("");
            setGalleryImageFiles([]);
            setGalleryImagePreviews([]);
          }
          setSuccessMessage("");
          // Navigate to product list
          navigate("/seller/product/list");
        }, 1500);
      } else {
        setUploadError(response.message || "Failed to create product");
      }
    } catch (error: any) {
      setUploadError(
        error.response?.data?.message ||
          error.message ||
          "Failed to upload images. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Section */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
              <h2 className="text-lg font-semibold">Product</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Product Name
                  </label>
                  <input
                    type="text"
                    name="productName"
                    value={formData.productName}
                    onChange={handleChange}
                    maxLength={100}
                    placeholder="Enter Product Name"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <div className="flex justify-end items-center mt-1">
                    <p className="text-xs text-neutral-500">{formData.productName.length}/100</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Header Category{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="headerCategory"
                    value={formData.headerCategory}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="">Select Header Category</option>
                    {headerCategories.map((headerCat) => (
                      <option key={headerCat._id} value={headerCat._id}>
                        {headerCat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Category
                    {!formData.headerCategory && (
                      <span className="text-xs text-neutral-500 ml-1">
                        (Select header category first)
                      </span>
                    )}
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    disabled={!formData.headerCategory}
                    className={`w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      !formData.headerCategory
                        ? "bg-neutral-100 cursor-not-allowed text-neutral-500"
                        : "bg-white"
                    }`}>
                    <option value="">
                      {formData.headerCategory
                        ? "Select Category"
                        : "Select Header Category First"}
                    </option>
                    {categories
                      .filter((cat: any) => {
                        // Filter categories by selected header category if header category is selected
                        if (formData.headerCategory) {
                          const catHeaderId =
                            typeof cat.headerCategoryId === "string"
                              ? cat.headerCategoryId
                              : cat.headerCategoryId?._id;
                          return catHeaderId === formData.headerCategory;
                        }
                        return true;
                      })
                      .map((cat: any) => (
                        <option
                          key={cat._id || cat.id}
                          value={cat._id || cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select SubCategory
                    {!formData.category && (
                      <span className="text-xs text-neutral-500 ml-1">
                        (Select category first)
                      </span>
                    )}
                  </label>
                  <select
                    name="subcategory"
                    value={formData.subcategory}
                    onChange={handleChange}
                    disabled={!formData.category}
                    className={`w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      !formData.category
                        ? "bg-neutral-100 cursor-not-allowed text-neutral-500"
                        : "bg-white"
                    }`}>
                    <option value="">
                      {formData.category
                        ? "Select Subcategory"
                        : "Select Category First"}
                    </option>
                    {subcategories.map((sub) => (
                      <option key={sub._id} value={sub._id}>
                        {sub.subcategoryName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Sub-SubCategory
                    {!formData.subcategory && (
                      <span className="text-xs text-neutral-500 ml-1">
                        (Select subcategory first)
                      </span>
                    )}
                  </label>
                  <select
                    name="subSubCategory"
                    value={formData.subSubCategory}
                    onChange={handleChange}
                    disabled={!formData.subcategory}
                    className={`w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${
                      !formData.subcategory
                        ? "bg-neutral-100 cursor-not-allowed text-neutral-500"
                        : "bg-white"
                    }`}>
                    <option value="">Select Sub-SubCategory</option>
                    {subSubCategories.map((subSub) => (
                      <option key={subSub._id} value={subSub._id}>
                        {subSub.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Product Publish Or Unpublish?
                  </label>
                  <select
                    name="publish"
                    value={formData.publish}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Brand
                  </label>
                  <select
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="">Select Brand</option>
                    {brands.map((brand) => (
                      <option key={brand._id} value={brand._id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Tags
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="Select or create tags"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Small Description
                </label>
                <textarea
                  name="smallDescription"
                  value={formData.smallDescription}
                  onChange={handleChange}
                  maxLength={500}
                  placeholder="Enter Product Small Description"
                  rows={4}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                />
                <p className="text-xs text-neutral-500 mt-1 text-right">
                  {formData.smallDescription.length}/500
                </p>
              </div>
            </div>
          </div>



          {/* Add Variation Section */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
              <h2 className="text-lg font-semibold">Add Variation</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Product Variation Type
                </label>
                <select
                  name="variationType"
                  value={formData.variationType}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">Select Product Type</option>
                  <option value="Size">Size</option>
                  <option value="Weight">Weight</option>
                  <option value="Color">Color</option>
                  <option value="Pack">Pack</option>
                  <option value="Variant">Variant</option>
                  <option value="Options">Options</option>
                </select>
              </div>

              {/* Variation Form */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-neutral-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Title (e.g., 100g)
                  </label>
                  <input
                    type="text"
                    value={variationForm.title}
                    onChange={(e) =>
                      setVariationForm({
                        ...variationForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="100g"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Price *
                  </label>
                  <input
                    type="number"
                    value={variationForm.price}
                    onChange={(e) => handleVariationNumberChange("price", e.target.value)}
                    placeholder="100"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Discounted Price
                  </label>
                  <input
                    type="number"
                    value={variationForm.discPrice}
                    onChange={(e) => handleVariationNumberChange("discPrice", e.target.value)}
                    placeholder="80"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Stock
                  </label>
                  <input
                    type="number"
                    value={variationForm.stock}
                    onChange={(e) => handleVariationNumberChange("stock", e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={addVariation}
                    className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium">
                    {editVariationIndex !== null ? "Save Variation" : "Add Variation"}
                  </button>
                  {editVariationIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditVariationIndex(null);
                        setVariationForm({
                          title: "",
                          price: "",
                          discPrice: "0",
                          stock: "0",
                          status: "Available",
                        });
                      }}
                      className="px-4 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg font-medium">
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Variations List */}
              {variations.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">
                    Added Variations:
                  </h3>
                  <div className="space-y-2">
                    {variations.map((variation, index) => (
                      <div
                        key={index}
                        className={`flex items-center justify-between p-3 bg-white border ${editVariationIndex === index ? 'border-teal-500 ring-1 ring-teal-500' : 'border-neutral-200'} rounded-lg`}>
                        <div className="flex-1">
                          <span className="font-medium">{variation.title}</span>{" "}
                          - ₹{variation.price}
                          {variation.discPrice > 0 && (
                            <span className="text-green-600 ml-2">
                              (₹{variation.discPrice})
                            </span>
                          )}
                          <span className="ml-4 text-sm text-neutral-600">
                            Stock: {variation.stock} | Status: {variation.status}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <button
                            type="button"
                            onClick={() => editVariation(index)}
                            className="text-teal-600 hover:text-teal-700 ml-4">
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeVariation(index)}
                            className="text-red-600 hover:text-red-700 ml-4">
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Add Other Details Section */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
              <h2 className="text-lg font-semibold">Add Other Details</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    name="manufacturer"
                    value={formData.manufacturer}
                    onChange={handleChange}
                    placeholder="Enter Manufacturer"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Made In
                  </label>
                  <input
                    type="text"
                    name="madeIn"
                    value={formData.madeIn}
                    onChange={handleChange}
                    placeholder="Enter Made In"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Tax
                  </label>
                  <select
                    name="tax"
                    value={formData.tax}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="">Select Tax</option>
                    {taxes.map((tax) => (
                      <option key={tax._id} value={tax._id}>
                        {tax.name} ({tax.percentage}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    is Returnable?
                  </label>
                  <select
                    name="isReturnable"
                    value={formData.isReturnable}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Max Return Days
                  </label>
                  <input
                    type="number"
                    name="maxReturnDays"
                    value={formData.maxReturnDays}
                    onChange={handleChange}
                    placeholder="Enter Max Return Days"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    FSSAI Lic. No.
                  </label>
                  <div className="flex rounded-lg shadow-sm">
                    <span className="px-3 py-2 bg-neutral-100 border border-r-0 border-neutral-300 rounded-l-lg text-neutral-600 text-sm whitespace-nowrap">
                      FSSAI Lic. No.
                    </span>
                    <input
                      type="text"
                      name="fssaiLicNo"
                      value={formData.fssaiLicNo}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 14);
                        handleChange({ target: { name: 'fssaiLicNo', value: val } } as any);
                      }}
                      placeholder="14-digit number"
                      className="flex-1 min-w-0 px-4 py-2 border border-neutral-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Total allowed quantity
                  </label>
                  <input
                    type="number"
                    name="totalAllowedQuantity"
                    value={formData.totalAllowedQuantity}
                    onChange={handleChange}
                    placeholder="Enter Total allowed quantit"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Keep blank if no such limit
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Add Images Section */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
              <h2 className="text-lg font-semibold">Add Images</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-6">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {uploadError}
                </div>
              )}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {successMessage}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Main Image <span className="text-red-500">*</span>
                </label>
                <label className="block border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-teal-500 transition-colors cursor-pointer">
                  {mainImagePreview ? (
                    <div className="space-y-2">
                      <img
                        src={mainImagePreview}
                        alt="Main product preview"
                        className="max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <p className="text-sm text-neutral-600">
                        {mainImageFile?.name}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setMainImageFile(null);
                          setMainImagePreview("");
                        }}
                        className="text-sm text-red-600 hover:text-red-700">
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto mb-2 text-neutral-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p className="text-sm text-neutral-600 font-medium">
                        Upload Main Image
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Max 5MB, JPG/PNG/WEBP
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleMainImageChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Gallery Images (Optional)
                </label>
                <label className="block border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-teal-500 transition-colors cursor-pointer">
                  {galleryImagePreviews.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {galleryImagePreviews.map((preview, index) => (
                          <div key={index} className="relative">
                            <img
                              src={preview}
                              alt={`Gallery ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                removeGalleryImage(index);
                              }}
                              className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-neutral-600">
                        {galleryImageFiles.length} image(s) selected
                      </p>
                    </div>
                  ) : (
                    <div>
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mx-auto mb-2 text-neutral-400">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p className="text-sm text-neutral-600 font-medium">
                        Upload Other Product Images Here
                      </p>
                      <p className="text-xs text-neutral-500 mt-1">
                        Max 5MB per image, up to 10 images
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryImagesChange}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Shop by Store Section */}
          <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
            <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
              <h2 className="text-lg font-semibold">Shop by Store</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> If you select "Show in Shop by Store
                  only", this product will only be visible in the Shop by Store
                  section and will not appear on category pages, home page, or
                  any other pages.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Show in Shop by Store only?
                  </label>
                  <select
                    name="isShopByStoreOnly"
                    value={formData.isShopByStoreOnly}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                {formData.isShopByStoreOnly === "Yes" && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Select Store <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="shopId"
                      value={formData.shopId}
                      onChange={handleChange}
                      required={formData.isShopByStoreOnly === "Yes"}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                      <option value="">Select Store</option>
                      {shops.map((shop) => (
                        <option key={shop._id} value={shop._id}>
                          {shop.name}
                        </option>
                      ))}
                    </select>
                    {shops.length === 0 && (
                      <p className="text-xs text-neutral-500 mt-1">
                        No active stores available. Please contact admin to
                        create stores.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pb-6">
            <button
              type="submit"
              disabled={uploading}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-colors shadow-sm ${
                uploading
                  ? "bg-neutral-400 cursor-not-allowed text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}>
              {uploading ? "Uploading Images..." : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
