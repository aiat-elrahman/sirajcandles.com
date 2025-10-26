import express from 'express';
import multer from 'multer';
import {
    createProduct,
    getAllProducts,
    getProductById,
    updateProduct, // <-- Import update function
    deleteProduct  // <-- Import delete function
} from '../controllers/ProductController.js';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Define Routes ---

// GET /api/products
router.get('/', getAllProducts);

// GET /api/products/:id
router.get('/:id', getProductById);

// POST /api/products
router.post('/', upload.array('productImages', 5), createProduct);

// PUT /api/products/:id - Update product
router.put('/:id', upload.array('productImages', 5), updateProduct); // Allow images on update

// DELETE /api/products/:id - Delete product
router.delete('/:id', deleteProduct);

export default router;