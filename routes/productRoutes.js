import { Router } from 'express';
import multer from 'multer'; // 🧩 Multer for file handling
// 🧩 NEW: Import the controller functions from the file we created in Step 2
import { 
    createProduct, 
    getProductById, 
    getAllProducts 
} from '../controllers/ProductController.js'; 

const router = Router();

// --- 1. MULTER CONFIGURATION (CHANGED FOR CLOUDINARY) ---
// We MUST use memoryStorage() to avoid saving files to the server's disk, 
// which is required for Render's free tier and for passing buffers to Cloudinary.
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit per file
});

// --- 2. PUBLIC GET ENDPOINTS (Logic is now handled by Controller) ---

// GET /api/products - Fetch all products (for main grid page, handles search/sort/filter)
// We remove the async/await logic here and rely on getAllProducts in the Controller
router.get('/', getAllProducts);

// GET /api/products/:id - Fetch single product/bundle detail
// We remove the async/await logic here and rely on getProductById in the Controller
router.get('/:id', getProductById);


// --- 3. ADMIN POST ENDPOINT (Create Product/Bundle) ---

// POST /api/products - ADMIN CREATE NEW PRODUCT/BUNDLE
// Multer intercepts the request first using the key 'productImages' (from React Admin form)
// The logic for saving to MongoDB and Cloudinary is entirely in the Controller.
router.post(
    '/', 
    upload.array('productImages', 10), // Max 10 images
    createProduct // Passes control to the controller
);


// --- 4. ADMIN PUT/DELETE ENDPOINTS (Keeping your existing structure for now) ---
// NOTE: These need updating later to handle Cloudinary image deletion/uploading correctly.

// Update product - Still uses disk storage for now, will need Cloudinary logic later
router.put("/:id", upload.array("images", 5), async (req, res) => {
    // This logic needs to be moved to a controller, but we keep it here for continuity.
    // It will break because the request structure has changed and it uses old fields (name, images, etc.)
    res.status(501).json({ message: "Update endpoint requires refactoring for Cloudinary and new schema fields (price_egp, name_en, etc.)." });
});

// DELETE PRODUCT 
router.delete("/:id", async (req, res) => {
    // This logic needs to be moved to a controller and must include Cloudinary asset deletion.
    res.status(501).json({ message: "Delete endpoint requires refactoring for Cloudinary asset deletion." });
});


export default router;
