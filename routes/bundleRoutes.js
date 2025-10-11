import express from "express";
import Bundle from "../models/Bundle.js";
import multer from "multer";

const router = express.Router();

// multer? don't understand :()
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/bundles/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// search & pagination & sorting
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", sort } = req.query;

    let query = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    let bundles = Bundle.find(query).populate("products");

    if (sort === "price_asc") bundles = bundles.sort({ price: 1 });
    else if (sort === "price_desc") bundles = bundles.sort({ price: -1 });
    else if (sort === "newest") bundles = bundles.sort({ createdAt: -1 });

    const total = await Bundle.countDocuments(query);
    const results = await bundles.skip((page - 1) * limit).limit(Number(limit));

    res.json({ total, page: Number(page), limit: Number(limit), results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//  GET  BY ID 
router.get("/:id", async (req, res) => {
  try {
    const bundle = await Bundle.findById(req.params.id).populate("products");
    if (!bundle) return res.status(404).json({ message: "Bundle not found" });
    res.json(bundle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ADD NEW  
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, products, status, featured } = req.body;
    const imagePath = req.file ? req.file.path : null;

    const bundle = new Bundle({
      name,
      description,
      price,
      products,
      image: imagePath,
      status,
      featured,
    });

    const savedBundle = await bundle.save();
    res.status(201).json(savedBundle);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//  UPDATE BUNDLE 
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const { name, description, price, products, status, featured } = req.body;
    const imagePath = req.file ? req.file.path : null;

    const updatedBundle = await Bundle.findByIdAndUpdate(
      req.params.id,
      { name, description, price, products, status, featured, ...(imagePath && { image: imagePath }) },
      { new: true }
    ).populate("products");

    if (!updatedBundle) return res.status(404).json({ message: "Bundle not found" });
    res.json(updatedBundle);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE BUNDLE 
router.delete("/:id", async (req, res) => {
  try {
    const deletedBundle = await Bundle.findByIdAndDelete(req.params.id);
    if (!deletedBundle) return res.status(404).json({ message: "Bundle not found" });
    res.json({ message: "Bundle deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
