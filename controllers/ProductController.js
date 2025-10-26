import cloudinary from 'cloudinary';
import Product from '../models/Product.js';
import DatauriParser from 'datauri/parser.js';
import path from 'path';

// --- CONFIGURE CLOUDINARY ---
cloudinary.v2.config({ // Use cloudinary.v2.config
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // Removed default values
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// --- HELPERS ---
const parser = new DatauriParser();
const formatBufferToDataUri = file => parser.format(path.extname(file.originalname).toString(), file.buffer);

const uploadToCloudinary = async (file) => {
    try {
        const dataUri = formatBufferToDataUri(file);
        const uploadResult = await cloudinary.v2.uploader.upload(dataUri.content, { // Use cloudinary.v2.uploader
            folder: 'siraj-ecommerce-products',
            resource_type: 'auto'
        });
        return uploadResult.secure_url; // Returns the public URL
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        throw new Error('Image upload failed.');
    }
};

// --- CONTROLLER FUNCTIONS ---

/**
 * Endpoint: POST /api/products (Admin panel submission)
 * Handles the creation of a new product (Single or Bundle)
 */
export const createProduct = async (req, res) => {
    try {
        // 1. Validation and Data Parsing
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'Product requires at least one image.' });
        }
        // Use req.body.productData (matches admin panel)
        if (!req.body.productData) {
            return res.status(400).json({ message: 'Product data (text fields) is missing.' });
        }

        const productData = JSON.parse(req.body.productData);
        const { productType } = productData;

        // 2. Upload images to Cloudinary concurrently
        const uploadPromises = req.files.map(file => uploadToCloudinary(file));
        const imagePaths = await Promise.all(uploadPromises);

        // 3. Prepare the final document for MongoDB
        let finalProductDoc = {
            productType: productType,
            imagePaths: imagePaths,
            category: productData.category,

            // FIX: Add 'name' and 'price' required by Mongoose model
            name: productType === 'Bundle' ? productData.bundleName : productData.name_en,
            price: productData.price_egp, // Copy value from price_egp

            // Keep the specific fields
            price_egp: productData.price_egp,
            stock: productData.stock,
            status: productData.status,
            featured: productData.featured || false,
        };

        // Add type-specific fields
        if (productType === 'Bundle') {
            Object.assign(finalProductDoc, {
                name_en: productData.bundleName, // Keep name_en for consistency if needed elsewhere
                description_en: productData.bundleDescription,
                bundleName: productData.bundleName,
                bundleDescription: productData.bundleDescription,
                bundleItems: productData.bundleItems,
            });
        } else { // Single Product
            Object.assign(finalProductDoc, {
                name_en: productData.name_en, // Keep name_en
                description_en: productData.description_en,
                scents: productData.scents,
                size: productData.size,
                formattedDescription: productData.formattedDescription,
                burnTime: productData.burnTime,
                wickType: productData.wickType,
                coverageSpace: productData.coverageSpace,
            });
        }

        // 4. Save the product to MongoDB
        const newProduct = await Product.create(finalProductDoc);

        res.status(201).json({
            success: true,
            message: 'Product created successfully!',
            product: newProduct
        });

    } catch (error) {
        // Log the detailed validation error if it occurs
        console.error('Error creating product:', error);
        res.status(500).json({
            message: 'Server error during product creation.',
            // Include the specific validation error message from Mongoose
            error: error.message
        });
    }
};

/**
 * Endpoint: GET /api/products (Frontend list)
 * Retrieves products based on query parameters
 */
export const getAllProducts = async (req, res) => {
    try {
        const { page = 1, limit = 12, category, productType, sort, order = 'asc', search, exclude_id, isBestSeller } = req.query;
        const query = { status: 'Active' };

        // Build Mongoose Query
        if (category) query.category = category;
        if (productType) query.productType = productType;

        if (search) {
            query.$or = [
                { name_en: { $regex: search, $options: 'i' } },
                { bundleName: { $regex: search, $options: 'i' } }, // Also search bundle names if applicable
                { description_en: { $regex: search, $options: 'i' } }
            ];
        }
        if (exclude_id) query._id = { $ne: exclude_id };
        if (isBestSeller === 'true') query.featured = true;

        // Sorting
        // Use 'price_egp' for price sorting as it exists on both types
        const sortCriteria = {};
        if (sort === 'price') {
            sortCriteria['price_egp'] = order === 'desc' ? -1 : 1;
        } else if (sort === 'name') {
             // Sort primarily by name_en, fallback to bundleName if name_en is missing (for bundles)
             sortCriteria['name_en'] = order === 'desc' ? -1 : 1;
             sortCriteria['bundleName'] = order === 'desc' ? -1 : 1;
        } else if (sort === 'newest' || !sort) {
            sortCriteria['createdAt'] = -1; // Default sort by newest
        } else if (sort) {
             // Allow sorting by other fields if specified (like name_en directly)
             sortCriteria[sort] = order === 'desc' ? -1 : 1;
        }


        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: sortCriteria
        };

        const products = await Product.find(query, null, options);
        const total = await Product.countDocuments(query);

        // Map data to match the FE's expected property names (for consistency)
        // No need for extra formatting keys like 'Name (English)' if FE uses fallbacks
        const formattedResults = products.map(p => ({
            ...p._doc, // Include all fields directly from the database document
        }));

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            results: formattedResults, // Send the direct results
        });

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Failed to fetch products.' });
    }
};


/**
 * Endpoint: GET /api/products/:id (Frontend detail page)
 * Retrieves a single product or bundle by ID
 */
export const getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product || product.status === 'Inactive') {
            return res.status(404).json({ message: 'Product not found or is inactive.' });
        }

        // Send the raw product data directly - Frontend handles display logic
        res.json({
           ...product._doc // Include all fields directly from the database document
        });

    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ message: 'Failed to fetch product details.' });
    }
};