import { Request, Response } from "express";
import xlsx from "xlsx";
import AdmZip from "adm-zip";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import Product from "../../../models/Product";
import Category from "../../../models/Category";
import SubCategory from "../../../models/SubCategory";
import Brand from "../../../models/Brand";
import HeaderCategory from "../../../models/HeaderCategory";
import Tax from "../../../models/Tax";
import Shop from "../../../models/Shop";
import { asyncHandler } from "../../../utils/asyncHandler";
import { UPLOADS_ROOT } from "../../../utils/ensureUploadDirs";

// Helper to generate a unique filename
const generateUniqueFilename = (originalName: string) => {
  const ext = path.extname(originalName);
  const randomStr = crypto.randomBytes(8).toString("hex");
  return `${Date.now()}-${randomStr}${ext}`;
};

export const bulkValidateProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const files = req.files as any;
    if (!files || !files.excelFile || files.excelFile.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required",
      });
    }

    const excelBuffer = files.excelFile[0].buffer;
    const zipBuffer =
      files.imagesZip && files.imagesZip.length > 0
        ? files.imagesZip[0].buffer
        : null;

    // ── Parse Excel ──────────────────────────────────────────────────────────
    const workbook = xlsx.read(excelBuffer, { type: "buffer" });
    let productSheet = workbook.Sheets["Products"] || workbook.Sheets[workbook.SheetNames[0]];
    const variationSheet = workbook.Sheets["Variations"];

    if (!productSheet) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty or invalid",
      });
    }

    const productsData: any[] = xlsx.utils.sheet_to_json(productSheet);
    const variationsData: any[] = variationSheet
      ? xlsx.utils.sheet_to_json(variationSheet)
      : [];

    if (productsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products sheet is empty",
      });
    }

    // ── Extract ZIP images ───────────────────────────────────────────────────
    // imageMap: original filename → server URL
    const imageMap = new Map<string, string>();
    if (zipBuffer) {
      const zip = new AdmZip(zipBuffer);
      const zipEntries = zip.getEntries();
      const productsDir = path.join(UPLOADS_ROOT, "products");

      if (!fs.existsSync(productsDir)) {
        fs.mkdirSync(productsDir, { recursive: true });
      }

      for (const entry of zipEntries) {
        if (
          !entry.isDirectory &&
          entry.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)
        ) {
          try {
            const buffer = entry.getData();
            if (buffer.length <= 10 * 1024 * 1024) {
              const newFilename = generateUniqueFilename(entry.name);
              const destPath = path.join(productsDir, newFilename);
              fs.writeFileSync(destPath, buffer);
              const backendUrl =
                process.env.BACKEND_URL || "http://localhost:5000";
              const url = `${backendUrl}/uploads/products/${newFilename}`;
              imageMap.set(entry.name, url);
            }
          } catch (err) {
            console.error(`Failed to extract image ${entry.name}:`, err);
          }
        }
      }
    }

    // ── Load lookup tables ───────────────────────────────────────────────────
    const headerCategories = await HeaderCategory.find()
      .select("_id name")
      .lean();
    
    // Fetch all categories (root, sub, and sub-sub in the new model)
    const allCategories = await Category.find().select("_id name headerCategoryId parentId").lean();
    
    // Filter out root categories (they usually don't have a parentId)
    const categories = allCategories.filter((c: any) => !c.parentId);
    
    // New model subcategories are those with a parentId
    const newSubCategories = allCategories.filter((c: any) => c.parentId);

    // Old model subcategories
    const oldSubCategories = await SubCategory.find().select("_id name category").lean();
    
    const brands = await Brand.find().select("_id name").lean();
    const taxes = await Tax.find().select("_id name percentage").lean();
    const shops = await Shop.find({ isActive: true }).select("_id name").lean();

    // Case-insensitive lookup helpers
    const findHeaderCategoryId = (name: string) =>
      headerCategories.find(
        (h) => h.name.toLowerCase() === name?.toLowerCase()
      )?._id;

    const findCategoryId = (name: string, headerCatId: any) => {
      // Find a root category matching the name
      // Ideally we would also check headerCatId, but for now just name match
      const found = categories.find(
        (c) => c.name.toLowerCase() === name?.toLowerCase()
      );
      return found?._id;
    };

    const findSubCategoryId = (name: string, catId: any) => {
      // Check new model first (where parentId matches catId)
      let found: any = newSubCategories.find(
        (s: any) => s.name.toLowerCase() === name?.toLowerCase() && s.parentId?.toString() === catId?.toString()
      );
      
      // Fallback to old model
      if (!found) {
        found = oldSubCategories.find(
          (s: any) => s.name.toLowerCase() === name?.toLowerCase() && s.category?.toString() === catId?.toString()
        );
      }
      return found?._id;
    };

    const findSubSubCategoryId = (name: string, subCatId: any) => {
      // Sub-sub categories are categories where parentId = subCatId
      const found = allCategories.find(
        (c: any) => c.name.toLowerCase() === name?.toLowerCase() && c.parentId?.toString() === subCatId?.toString()
      );
      return found?._id;
    };

    const findBrandId = (name: string) =>
      brands.find((b) => b.name.toLowerCase() === name?.toLowerCase())?._id;

    const findTaxId = (name: string) =>
      taxes.find((t) => t.name.toLowerCase() === name?.toLowerCase())?._id;

    const findShopId = (name: string) =>
      shops.find((s) => s.name.toLowerCase() === name?.toLowerCase())?._id;

    const VALID_VARIATION_TYPES = ["Size", "Weight", "Color", "Pack", "Variant", "Options"];

    // ── Validate each product row ────────────────────────────────────────────
    const validProducts: any[] = [];
    const invalidProducts: any[] = [];

    for (let i = 0; i < productsData.length; i++) {
      const row = productsData[i];
      const errors: string[] = [];

      // === Required fields ===
      if (!row["Product Name"]) errors.push("Product Name is required");
      if (!row["Header Category"]) errors.push("Header Category is required");
      if (!row["Category"]) errors.push("Category is required");
      if (!row["Weight (kg)"] && row["Weight (kg)"] !== 0)
        errors.push("Weight (kg) is required");

      // === Variation Type validation ===
      const variationType = row["Variation Type"]?.toString().trim();
      if (!variationType) {
        errors.push("Variation Type is required (Size | Weight | Color | Pack | Variant | Options)");
      } else if (!VALID_VARIATION_TYPES.includes(variationType)) {
        errors.push(`Variation Type '${variationType}' is invalid. Must be one of: ${VALID_VARIATION_TYPES.join(", ")}`);
      }

      // === Header Category lookup ===
      let headerCategoryId = null;
      if (row["Header Category"]) {
        headerCategoryId = findHeaderCategoryId(row["Header Category"]);
        if (!headerCategoryId)
          errors.push(`Header Category '${row["Header Category"]}' not found`);
      }

      // === Category lookup ===
      let categoryId = null;
      if (row["Category"]) {
        categoryId = findCategoryId(row["Category"], headerCategoryId);
        if (!categoryId)
          errors.push(`Category '${row["Category"]}' not found`);
      }

      // === SubCategory lookup (optional) ===
      let subCategoryId = null;
      if (row["SubCategory"]) {
        subCategoryId = findSubCategoryId(row["SubCategory"], categoryId);
        if (!subCategoryId)
          errors.push(`SubCategory '${row["SubCategory"]}' not found`);
      }

      // === Sub-SubCategory lookup (optional) ===
      let subSubCategoryId = null;
      if (row["Sub-SubCategory"]) {
        subSubCategoryId = findSubSubCategoryId(row["Sub-SubCategory"], subCategoryId);
        if (!subSubCategoryId)
          errors.push(`Sub-SubCategory '${row["Sub-SubCategory"]}' not found`);
      }

      // === Brand lookup (optional) ===
      let brandId = null;
      let newBrandName = null;
      if (row["Brand"]) {
        const brandStr = row["Brand"].toString().trim();
        brandId = findBrandId(brandStr);
        if (!brandId) {
          // Keep it to be created during import
          newBrandName = brandStr;
        }
      }

      // === Tax lookup (optional) ===
      let taxId = null;
      if (row["Tax Name"]) {
        taxId = findTaxId(row["Tax Name"]);
        if (!taxId) errors.push(`Tax '${row["Tax Name"]}' not found`);
      }

      // === Shop lookup (optional / conditional) ===
      let shopId = null;
      const isShopByStore = row["Shop By Store Only"]?.toString().toLowerCase() === "yes";
      if (isShopByStore) {
        if (!row["Shop Name"]) {
          errors.push("Shop Name is required when 'Shop By Store Only' is Yes");
        } else {
          shopId = findShopId(row["Shop Name"]);
          if (!shopId) errors.push(`Shop '${row["Shop Name"]}' not found`);
        }
      }

      // === Publish ===
      const publish = row["Publish"]?.toString().toLowerCase() === "yes";

      // === Is Returnable ===
      const isReturnable = row["Is Returnable"]?.toString().toLowerCase() === "yes";

      // === Images ===
      let mainImageUrl = "";
      if (row["Main Image"]) {
        mainImageUrl =
          imageMap.get(row["Main Image"]) || row["Main Image"];
        if (!mainImageUrl.startsWith("http") && !mainImageUrl.startsWith("/")) {
          errors.push(
            `Main Image '${row["Main Image"]}' not found in ZIP`
          );
        }
      }

      let galleryImageUrls: string[] = [];
      if (row["Gallery Images"]) {
        const names = row["Gallery Images"]
          .toString()
          .split(",")
          .map((n: string) => n.trim())
          .filter(Boolean);
        galleryImageUrls = names.map((name: string) => {
          const mapped = imageMap.get(name) || name;
          if (!mapped.startsWith("http") && !mapped.startsWith("/")) {
            errors.push(`Gallery Image '${name}' not found in ZIP`);
          }
          return mapped;
        });
      }

      // === Variations: match by Product Name ===
      const productVariations = variationsData.filter(
        (v) => v["Product Name"]?.toString().trim() === row["Product Name"]?.toString().trim()
      );

      const processedVariations = productVariations.map((v, vi) => {
        if (!v["Title"]) errors.push(`Variation row ${vi + 1} for '${row["Product Name"]}': Title is required`);
        if (!v["Price"]) errors.push(`Variation row ${vi + 1} for '${row["Product Name"]}': Price is required`);
        if (v["Stock"] === undefined || v["Stock"] === "")
          errors.push(`Variation row ${vi + 1} for '${row["Product Name"]}': Stock is required`);

        return {
          title: v["Title"] || "",
          price: Number(v["Price"]) || 0,
          discPrice: Number(v["Discounted Price"]) || 0,
          stock: Number(v["Stock"]) || 0,
          sku: v["SKU"] || "",
          status: "Available",
        };
      });

      // If no variations found, check if Price and Stock are on the main Product row
      if (processedVariations.length === 0) {
        if (row["Price"] && row["Stock"] !== undefined && row["Stock"] !== "") {
          processedVariations.push({
            title: "Default",
            price: Number(row["Price"]) || 0,
            discPrice: Number(row["Discounted Price"]) || 0,
            stock: Number(row["Stock"]) || 0,
            sku: "",
            status: "Available",
          });
        } else {
          errors.push(
            `No variations found for '${row["Product Name"]}'. Please add at least one row in the Variations sheet, OR provide Price and Stock directly in the Products sheet.`
          );
        }
      }

      if (errors.length > 0) {
        invalidProducts.push({ rowNumber: i + 2, data: row, errors });
      } else {
        validProducts.push({
          // Core
          productName: row["Product Name"],
          headerCategoryId: headerCategoryId,
          categoryId: categoryId,
          subcategoryId: subCategoryId,
          subSubCategoryId: subSubCategoryId,
          brandId: brandId,
          newBrandName: newBrandName,
          taxId: taxId,
          variationType: variationType,

          // Flags
          publish: publish,
          popular: false,
          dealOfDay: false,
          isReturnable: isReturnable,
          maxReturnDays: row["Max Return Days"] ? Number(row["Max Return Days"]) : undefined,
          totalAllowedQuantity: row["Total Allowed Quantity"] ? Number(row["Total Allowed Quantity"]) : 10,

          // Text
          smallDescription: row["Small Description"] || "",
          description: row["Description"] || "",
          tags: row["Tags"] ? row["Tags"].toString().split(",").map((t: string) => t.trim()) : [],
          manufacturer: row["Manufacturer"] || "",
          madeIn: row["Made In"] || "",
          fssaiLicNo: row["FSSAI Lic No"] ? row["FSSAI Lic No"].toString() : "",
          weight: Number(row["Weight (kg)"]) || 0,

          // SEO
          seoTitle: row["SEO Title"] || "",
          seoKeywords: row["SEO Keywords"] || "",
          seoImageAlt: row["SEO Image Alt"] || "",
          seoDescription: row["SEO Description"] || "",

          // Images
          mainImageUrl: mainImageUrl,
          galleryImageUrls: galleryImageUrls,

          // Shop by Store
          isShopByStoreOnly: isShopByStore,
          shopId: shopId || undefined,

          // Variations
          variations: processedVariations,
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        validProducts,
        invalidProducts,
        summary: {
          total: productsData.length,
          validCount: validProducts.length,
          invalidCount: invalidProducts.length,
        },
      },
    });
  }
);

export const bulkImportProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products provided for import",
      });
    }

    const importedProducts = [];
    const errors: string[] = [];

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        let finalBrandId = p.brandId;
        if (!finalBrandId && p.newBrandName) {
          let existingBrand = await Brand.findOne({ name: { $regex: new RegExp(`^${p.newBrandName}$`, "i") } });
          if (!existingBrand) {
            existingBrand = await Brand.create({ name: p.newBrandName });
          }
          finalBrandId = existingBrand._id;
        }

        const newProduct = {
          // Core identifiers
          seller: sellerId,
          headerCategoryId: p.headerCategoryId,
          category: p.categoryId,
          subcategory: p.subcategoryId,
          subSubCategory: p.subSubCategoryId,
          brand: finalBrandId,
          tax: p.taxId,

          // Product info
          productName: p.productName,
          smallDescription: p.smallDescription,
          description: p.description,
          tags: p.tags,
          manufacturer: p.manufacturer,
          madeIn: p.madeIn,
          fssaiLicNo: p.fssaiLicNo,
          weight: p.weight,
          variationType: p.variationType,

          // SEO
          seoTitle: p.seoTitle,
          seoKeywords: p.seoKeywords,
          seoImageAlt: p.seoImageAlt,
          seoDescription: p.seoDescription,

          // Flags
          publish: p.publish ?? false,
          popular: false,
          dealOfDay: false,
          isReturnable: p.isReturnable ?? false,
          maxReturnDays: p.maxReturnDays,
          totalAllowedQuantity: p.totalAllowedQuantity ?? 10,

          // Images
          mainImage: p.mainImageUrl,
          galleryImages: p.galleryImageUrls || [],

          // Shop by Store
          isShopByStoreOnly: p.isShopByStoreOnly ?? false,
          shopId: p.shopId,

          // Variations — map "title" → what the Product model expects
          variations: (p.variations || []).map((v: any) => ({
            name: "Variation",
            value: v.title,
            price: v.price,
            discPrice: v.discPrice,
            stock: v.stock,
            sku: v.sku,
            status: "Available",
          })),
        };

        if (newProduct.variations.length > 0) {
          (newProduct as any).price = newProduct.variations[0].price;
          (newProduct as any).discPrice = newProduct.variations[0].discPrice || 0;
          (newProduct as any).stock = newProduct.variations.reduce(
            (acc: number, curr: any) => acc + (parseInt(curr.stock) || 0),
            0
          );
        }

        const created = await Product.create(newProduct);
        importedProducts.push(created._id);
      } catch (err: any) {
        errors.push(
          `Error importing '${p.productName}': ${err.message}`
        );
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully imported ${importedProducts.length} products.`,
      data: {
        importedCount: importedProducts.length,
        errors,
      },
    });
  }
);
