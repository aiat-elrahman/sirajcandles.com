import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import DatauriParser from 'datauri/parser.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const parser = new DatauriParser();

const formatBufferToDataUri = (file) => {
  return parser.format(path.extname(file.originalname).toString(), file.buffer);
};

// Upload image endpoint
router.post('/', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const dataUri = formatBufferToDataUri(req.file);
    
    const uploadResult = await cloudinary.uploader.upload(dataUri.content, {
      folder: 'siraj-candles',
      transformation: [
        { quality: 'auto' },
        { fetch_format: 'auto' }
      ]
    });

    res.json({ 
      success: true, 
      imageUrl: uploadResult.secure_url 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

export default router;