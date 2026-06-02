import cloudinary from 'cloudinary';
import Product from '../models/Product.js';
import DatauriParser from 'datauri/parser.js';
import path from 'path';

// --- CONFIGURE CLOUDINARY ---
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- HELPERS ---
const parser = new DatauriParser();
const formatBufferToDataUri = file => parser.format(path.extname(file.originalname).toString(), file.buffer);

const uploadToCloudinary = async (file) => {
    try {
        const dataUri = formatBufferToDataUri(file);
        const uploadResult = await cloudinary.v2.uploader.upload(dataUri.content, {
            folder: 'siraj-ecommerce-products',
            resource_type: 'auto'
        });
        return uploadResult.secure_url;
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        throw new Error('Image upload failed.');
    }
};

// Helper function to build product data based on category and type
// ProductController.js - Update this helper function
const buildProductData = (productData, productType, imagePaths) => {
    // 1. Determine the "Common" name and price regardless of type
    const displayName = productType === 'Bundle' ? productData.bundleName : productData.name_en;
    const displayPrice = productType === 'Bundle' ? productData.bundlePrice : productData.price_egp;

   let finalProductDoc = {
        productType: productType,
        imagePaths: imagePaths,
        category: productData.category,
        subcategory: productData.subcategory || '', 
        name: displayName,
        price: displayPrice,
        price_egp: displayPrice,
        stock: productType === 'Bundle' ? 999 : productData.stock,
        status: productData.status,
        featured: productData.featured || false,
        
        // ADD THESE THREE LINES:
        stockOnline: productData.stockOnline !== undefined ? Number(productData.stockOnline) : 0,
        stockSabeel: productData.stockSabeel !== undefined ? Number(productData.stockSabeel) : 0,
        stockCloudsTex: productData.stockCloudsTex !== undefined ? Number(productData.stockCloudsTex) : 0,
    };

    if (productType === 'Bundle') {
        Object.assign(finalProductDoc, {
            name_en: productData.bundleName,
            description_en: productData.bundleDescription,
            bundleName: productData.bundleName,
            bundleDescription: productData.bundleDescription,
            bundlePrice: productData.bundlePrice,
            bundleOriginalPrice: productData.bundleOriginalPrice,
            bundleItems: productData.bundleItems,
        });
    } else {
        // Single Product - include ALL possible fields, they'll be saved based on category
        Object.assign(finalProductDoc, {
            name_en: productData.name_en,
            description_en: productData.description_en,
            variants: productData.variants,
            // General fields
            scents: productData.scents,
            size: productData.size,
            formattedDescription: productData.formattedDescription,
            
            // Selectable Options Fields
            scentOptions: productData.scentOptions,
            sizeOptions: productData.sizeOptions,
            weightOptions: productData.weightOptions,
            typeOptions: productData.typeOptions,
            shapeOptions: productData.shapeOptions,
            
            // Candle & Pottery Specifications
            burnTime: productData.burnTime,
            wickType: productData.wickType,
            coverageSpace: productData.coverageSpace,
            
            // Deodorant Specifications
            skinType: productData.skinType,
            keyIngredients: productData.keyIngredients,
            
            // Soap Specifications  
            featureBenefit: productData.featureBenefit,
            soapWeight: productData.soapWeight,
            
            // Body Oil Specifications
            color: productData.color,
            oilWeight: productData.oilWeight,
            
            // Massage Candle Specifications
            massageWeight: productData.massageWeight,
            
            // Wax Burner Specifications
            dimensions: productData.dimensions,
            material: productData.material,
            
            // Fizzy Salts
            fizzySpecs: productData.fizzySpecs,
        });
    }

    return finalProductDoc;
};
// --- BUNDLE STOCK CALCULATOR ---
const calculateBundleStock = async (product) => {
    if (!product.bundleItems || product.bundleItems.length === 0) return 0;

    // Count how many of each linked product are required for ONE bundle
    const reqCounts = {};
    product.bundleItems.forEach(item => {
        if (item.linkedProductId) {
            reqCounts[item.linkedProductId.toString()] = (reqCounts[item.linkedProductId.toString()] || 0) + 1;
        }
    });

    // If no products were linked, it has no real stock
    if (Object.keys(reqCounts).length === 0) return 0;

    let maxBundleStock = Infinity;

    // Check the live database stock for each required item
    for (const [linkedId, neededQty] of Object.entries(reqCounts)) {
        try {
            const linkedProduct = await Product.findById(linkedId);
            if (linkedProduct) {
                // Find total available online stock across all variants or base stock
                const available = linkedProduct.variants && linkedProduct.variants.length > 0 
                    ? linkedProduct.variants.reduce((sum, v) => sum + (v.stockOnline !== undefined ? v.stockOnline : v.stock), 0)
                    : (linkedProduct.stockOnline !== undefined ? linkedProduct.stockOnline : linkedProduct.stock);
                
                // e.g., 9 available / 4 needed = 2 possible bundles
                const possibleBundles = Math.floor(available / neededQty);
                if (possibleBundles < maxBundleStock) {
                    maxBundleStock = possibleBundles;
                }
            } else {
                maxBundleStock = 0; // Linked product was deleted
            }
        } catch (err) {
            maxBundleStock = 0;
        }
    }

    return maxBundleStock === Infinity ? 0 : maxBundleStock;
};
// --- CONTROLLER FUNCTIONS ---

/**
 * Endpoint: POST /api/products (Admin panel submission)
 */
export const createProduct = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Product requires at least one image.' });
        }
        if (!req.body.productData) {
            return res.status(400).json({ message: 'Product data (text fields) is missing.' });
        }

        const productData = JSON.parse(req.body.productData);
        const { productType } = productData;

        const uploadPromises = req.files.map(file => uploadToCloudinary(file));
        const imagePaths = await Promise.all(uploadPromises);

        const finalProductDoc = buildProductData(productData, productType, imagePaths);
        const newProduct = await Product.create(finalProductDoc);

        res.status(201).json({
            success: true,
            message: 'Product created successfully!',
            product: newProduct
        });

    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({
            message: 'Server error during product creation.',
            error: error.message
        });
    }
};

/**
 * Endpoint: GET /api/products (Frontend list & Admin list)
 */
export const getAllProducts = async (req, res) => {
    try {
        // ✅ FIX: Add 'sub' to destructuring
        const { 
            page = 1, 
            limit = 12, 
            category, 
            sub,           // ← ADD THIS
            productType, 
            sort, 
            order = 'asc', 
            search, 
            exclude_id, 
            isBestSeller, 
            status 
        } = req.query;

        // Default to Active for frontend, allow filtering by status for admin
        const query = status ? { status } : { status: 'Active' };

        // ✅ FIX: Use destructured 'sub' variable
        if (category) query.category = category;
        if (sub) query.subcategory = sub;  // ← USE 'sub' NOT 'req.query.sub'
        if (productType) query.productType = productType;
        
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { name_en: { $regex: search, $options: 'i' } },
                { bundleName: { $regex: search, $options: 'i' } },
                { description_en: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (exclude_id) query._id = { $ne: exclude_id };
        if (isBestSeller === 'true') query.featured = true;

        // Sort criteria
        const sortCriteria = {};
        if (sort === 'price') {
            sortCriteria['price_egp'] = order === 'desc' ? -1 : 1;
        } else if (sort === 'name') {
            sortCriteria['name'] = order === 'desc' ? -1 : 1;
        } else if (sort === 'newest' || !sort) {
            sortCriteria['createdAt'] = -1;
        } else if (sort) {
            sortCriteria[sort] = order === 'desc' ? -1 : 1;
        }

        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: sortCriteria
        };

       const products = await Product.find(query, null, options);
        const total = await Product.countDocuments(query);

        // Calculate real stock for bundles before sending to frontend
        const results = await Promise.all(products.map(async (p) => {
            const productObj = { ...p._doc };
            
            if (productObj.productType === 'Bundle') {
                const realStock = await calculateBundleStock(productObj);
                productObj.stock = realStock;
                productObj.stockOnline = realStock;
            }
            
            return productObj;
        }));

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            results
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Failed to fetch products.' });
    }
}; 

/**
 * Endpoint: GET /api/products/:id (Frontend detail & Admin Edit)
 */
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        const productObj = { ...product._doc };

        // Calculate real stock if it is a bundle
        if (productObj.productType === 'Bundle') {
            const realStock = await calculateBundleStock(productObj);
            productObj.stock = realStock;
            productObj.stockOnline = realStock;
        }

        res.json(productObj);

    } catch (error) {
        console.error('Error fetching product by ID:', error);
        if (error.kind === 'ObjectId') {
             return res.status(400).json({ message: 'Invalid product ID format.' });
        }
        res.status(500).json({ message: 'Failed to fetch product details.' });
    }
};

/**
 * Endpoint: PUT /api/products/:id (Admin Edit submission)
 */
export const updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        if (!req.body.productData) {
            return res.status(400).json({ message: 'Product data (text fields) is missing for update.' });
        }

        // Parse productData ONCE at the top
        const productData = JSON.parse(req.body.productData);
        const { productType } = productData;

        // Use kept images from frontend (after user deleted some)
        let updatedImagePaths = productData.existingImagePaths || [];

        // Upload any new files and append them
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file));
            const newImagePaths = await Promise.all(uploadPromises);
            updatedImagePaths = [...updatedImagePaths, ...newImagePaths];
        }

        // Enforce max 5 images
        updatedImagePaths = updatedImagePaths.slice(0, 5);

        // Build update fields
        const updateFields = buildProductData(productData, productType, updatedImagePaths);

        // Unset fields that don't belong to this product type
        if (productType === 'Bundle') {
            updateFields.$unset = {
                scents: "", size: "", formattedDescription: "",
                scentOptions: "", sizeOptions: "", weightOptions: "", typeOptions: "", shapeOptions: "",
                burnTime: "", wickType: "", coverageSpace: "",
                skinType: "", keyIngredients: "",
                featureBenefit: "", soapWeight: "",
                color: "", oilWeight: "",
                massageWeight: "",
                dimensions: "", material: "",
                fizzySpecs: ""
            };
        } else {
            updateFields.$unset = {
                bundleName: "", bundleDescription: "", bundleItems: ""
            };
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            updateFields,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Product updated successfully!',
            product: updatedProduct
        });

    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({
            message: 'Server error during product update.',
            error: error.message
        });
    }
};
/**
 * Endpoint: DELETE /api/products/:id (Admin Delete action)
 */
export const deleteProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const deletedProduct = await Product.findByIdAndDelete(productId);

        if (!deletedProduct) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        res.status(200).json({
            success: true,
            message: 'Product deleted successfully!',
            productId: productId
        });

    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({
            message: 'Server error during product deletion.',
            error: error.message
        });
    }
};