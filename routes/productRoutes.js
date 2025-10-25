import express from 'express';
import multer from 'multer';
import {
    createProduct,
    getAllProducts,
    getProductById
    // Import updateProduct and deleteProduct if you create them in the controller
} from '../controllers/ProductController.js'; // Import controller functions

const router = express.Router();

// --- Multer Configuration for Cloudinary (In-Memory Storage) ---
// We store the image in memory temporarily before uploading to Cloudinary
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Define Routes ---

// GET /api/products - Fetch products (uses controller)
router.get('/', getAllProducts);

// GET /api/products/:id - Fetch single product (uses controller)
router.get('/:id', getProductById);

// POST /api/products - Create product (uses controller)
// We use upload.array('productImages', 5) to match your admin panel form key
// The controller will handle req.files and req.body.data
router.post('/', upload.array('productImages', 5), createProduct);

// PUT /api/products/:id - Update product (You'll need to add updateProduct logic to controller)
// router.put('/:id', upload.array('productImages', 5), updateProduct);

// DELETE /api/products/:id - Delete product (You'll need to add deleteProduct logic to controller)
// router.delete('/:id', deleteProduct);

export default router;