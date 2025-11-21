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
const buildProductData = (productData, productType, imagePaths) => {
    let finalProductDoc = {
        productType: productType,
        imagePaths: imagePaths,
        category: productData.category,
        name: productType === 'Bundle' ? productData.bundleName : productData.name_en,
        price: productData.price_egp,
        price_egp: productData.price_egp,
        stock: productData.stock,
        status: productData.status,
        featured: productData.featured || false,
    };

    if (productType === 'Bundle') {
        // Bundle specific fields
        Object.assign(finalProductDoc, {
            name_en: productData.bundleName,
            description_en: productData.bundleDescription,
            bundleName: productData.bundleName,
            bundleDescription: productData.bundleDescription,
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
        const { page = 1, limit = 12, category, productType, sort, order = 'asc', search, exclude_id, isBestSeller, status } = req.query;

        // Default to Active for frontend, allow filtering by status for admin
        const query = status ? { status } : { status: 'Active' };

        if (category) query.category = category;
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

        res.json({
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            results: products.map(p => ({ ...p._doc })),
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

        res.json({ ...product._doc });

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

        // --- Handle Image Updates ---
        let updatedImagePaths = product.imagePaths || [];

        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file));
            const newImagePaths = await Promise.all(uploadPromises);
            updatedImagePaths = [...updatedImagePaths, ...newImagePaths];
        }

        // --- Handle Text Data Update ---
        if (!req.body.productData) {
            return res.status(400).json({ message: 'Product data (text fields) is missing for update.' });
        }
        const productData = JSON.parse(req.body.productData);
        const { productType } = productData;

        // Build update fields using the same helper function
        const updateFields = buildProductData(productData, productType, updatedImagePaths);

        // Add unset operations for type switching
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