import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './models/Product.js';

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    const products = await Product.find();
    let updated = 0;

    for (const product of products) {
      let changed = false;

      // Product level
if (product.stock !== undefined && (product.stockOnline === undefined || product.stockOnline === 0)) {
        product.stockOnline = product.stock;
        changed = true;
      }

      // Variants
      if (product.variants && product.variants.length) {
        for (const variant of product.variants) {
if (variant.stock !== undefined && (variant.stockOnline === undefined || variant.stockOnline === 0)) {
            variant.stockOnline = variant.stock;
            changed = true;
          }
        }
      }

      if (changed) {
        await product.save();
        updated++;
        console.log(`Updated: ${product.name_en || product.bundleName || product.name}`);
      }
    }

    console.log(`✅ Migration complete. Updated ${updated} products.`);
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

run();