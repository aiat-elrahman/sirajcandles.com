import cloudinary from 'cloudinary';
// Note: We use the relative path to your models folder.
import Product from '../models/Product.js'; 
import DatauriParser from 'datauri/parser.js';
import path from 'path';

// --- IMPORTANT: CONFIGURE CLOUDINARY ---
// This uses environment variables from your Render server.
// You MUST set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME',
    api_key: process.env.CLOUDINARY_API_KEY || 'YOUR_API_KEY',
    api_secret: process.env.CLOUDINARY_API_SECRET || 'YOUR_API_SECRET'
});

// Helper setup for converting Multer buffer (in memory) to a data URI
// This format is required for Cloudinary to read the image file.
const parser = new DatauriParser();
const formatBufferToDataUri = file => parser.format(path.extname(file.originalname).toString(), file.buffer);


// Helper function to upload an image buffer to Cloudinary
const uploadToCloudinary = async (file) => {
    try {
        const dataUri = formatBufferToDataUri(file);
        const uploadResult = await cloudinary.uploader.upload(dataUri.content, { 
            folder: 'siraj-ecommerce-products', 
            resource_type: 'auto' 
        });
        return uploadResult.secure_url; // Returns the public URL
    } catch (error) {
        console.error('Cloudinary Upload Error:', error);
        throw new Error('Image upload failed.');
    }
};

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
        // CHANGE THIS LINE:
        if (!req.body.productData) { // <--- FROM req.body.data TO req.body.productData
            return res.status(400).json({ message: 'Product data (text fields) is missing.' });
        }

        const productData = JSON.parse(req.body.productData); // <--- FROM req.body.data TO req.body.productData
        const { productType } = productData;

        // 2. Upload images to Cloudinary concurrently
        // This is fast because it happens in parallel
        const uploadPromises = req.files.map(file => uploadToCloudinary(file));
        const imagePaths = await Promise.all(uploadPromises);
        
        // 3. Prepare the final document for MongoDB
        let finalProductDoc = {
            productType: productType,
            imagePaths: imagePaths,
            
            // Map common fields from the form data
            category: productData.category, // Category is now required for both Single/Bundle
            price_egp: productData.price_egp,
            stock: productData.stock,
            status: productData.status,
            featured: productData.featured || false,
        };

        if (productType === 'Bundle') {
            // Map Bundle Specific Fields
            Object.assign(finalProductDoc, {
                name_en: productData.bundleName, // Use name_en for bundle name storage
                description_en: productData.bundleDescription, // Use description_en for bundle description storage
                bundleName: productData.bundleName,
                bundleDescription: productData.bundleDescription,
                bundleItems: productData.bundleItems,
            });
        } else {
            // Map Single Product Fields (including admin specs)
            Object.assign(finalProductDoc, {
                name_en: productData.name_en,
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
        console.error('Error creating product:', error);
        res.status(500).json({ 
            message: 'Server error during product creation.', 
            error: error.message 
        });
    }
};

/**
 * Endpoint: GET /api/products (Frontend list)
 * Retrieves products based on query parameters (for all product and bundle grids)
 */
export const getAllProducts = async (req, res) => {
    try {
        // Extract query parameters
        const { page = 1, limit = 12, category, productType, sort, order, search, exclude_id, isBestSeller } = req.query;
        const query = { status: 'Active' }; 
        
        // Build Mongoose Query
        if (category) query.category = category;
        if (productType) query.productType = productType; // Filter by productType (Single or Bundle)
        
        if (search) {
            query.$or = [
                { name_en: { $regex: search, $options: 'i' } },
                { description_en: { $regex: search, $options: 'i' } }
            ];
        }
        if (exclude_id) query._id = { $ne: exclude_id };
        if (isBestSeller === 'true') query.featured = true; 

        // Sorting options
        const options = {
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            sort: sort ? { [sort]: order === 'desc' ? -1 : 1 } : { createdAt: -1 } 
        };

        const products = await Product.find(query, null, options);
        const total = await Product.countDocuments(query);

        // Map data to match the FE's expected property names (for consistency with old API)
        const formattedResults = products.map(p => ({
            ...p._doc, // Include all fields
            'Name (English)': p.productType === 'Bundle' ? p.bundleName : p.name_en,
            'Price (EGP)': p.price_egp,
            'Image path': p.imagePaths?.[0] || 'images/placeholder.jpg', // Use the first image path
            Category: p.category,
            Status: p.status,
            'Description (English)': p.description_en,
        }));


        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            results: formattedResults,
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
        
        // Map data to match the FE's expected property names 
        const formattedProduct = {
            ...product._doc,
            'Name (English)': product.productType === 'Bundle' ? product.bundleName : product.name_en,
            'Price (EGP)': product.price_egp,
            'Image path': product.imagePaths?.[0] || 'images/placeholder.jpg',
            'Image paths': product.imagePaths, // Send all images back
            Category: product.category,
            Status: product.status,
            'Description (English)': product.description_en,
            // Include specs for frontend display
            Size: product.size,
            Scents: product.scents,
            BurnTime: product.burnTime,
            WickType: product.wickType,
            CoverageSpace: product.coverageSpace,
        };

        res.json(formattedProduct);
    } catch (error) {
        console.error('Error fetching product by ID:', error);
        res.status(500).json({ message: 'Failed to fetch product details.' });
    }
};