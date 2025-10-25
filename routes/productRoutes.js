import express from "express";
import Product from "../models/Product.js";
import multer from "multer";

const router = express.Router();

// multer again
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/products/"); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

//search & pagination & sorting
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", category, minPrice, maxPrice, sort } = req.query;

    let query = {};

    // Search
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    // filter
    if (category) {
      query.category = category;
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let products = Product.find(query);

    // Sorting
    if (sort === "price_asc") products = products.sort({ price: 1 });
    else if (sort === "price_desc") products = products.sort({ price: -1 });
    else if (sort === "newest") products = products.sort({ createdAt: -1 });

    // Pagination
    const total = await Product.countDocuments(query);
    const results = await products.skip((page - 1) * limit).limit(Number(limit));

    res.json({ total, page: Number(page), limit: Number(limit), results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ID
router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//  ADD NEW products
router.post("/", upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, price, category, stock, status, featured } = req.body;
    const imagePaths = req.files ? req.files.map(file => file.path) : [];

    const product = new Product({
      name,
      description,
      price,
      category,
      images: imagePaths,
      stock,
      status,
      featured,
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// update product
router.put("/:id", upload.array("images", 5), async (req, res) => {
  try {
    const { name, description, price, category, stock, status, featured } = req.body;
    const imagePaths = req.files ? req.files.map(file => file.path) : [];

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, category, stock, status, featured, $push: { images: { $each: imagePaths } } },
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//  DELETE PRODUCT 
router.delete("/:id", async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;