import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  variantName: { type: String, default: '' },
  location: {
    type: String,
    enum: ['online', 'bazaar', 'sabeel', 'clouds_tex'],
    required: true,
  },
  quantityChange: { type: Number, required: true },
  currentStockBefore: { type: Number, required: true },
  currentStockAfter: { type: Number, required: true },
  movementType: {
    type: String,
    enum: [
      'sale',
      'web_order',
      'sale_edit_restore',
      'sale_edit_deduct',
      'sale_void_restore',
      'exchange_return',
      'exchange_deduct',
      'manual_adjustment',
      'stock_transfer_out',
      'stock_transfer_in',
      'restock',
      'damage',
      'lost',
      'correction',
      'snapshot',
    ],
    required: true,
  },
  reason: { type: String, default: '' },
  sourceType: { type: String, default: '' },
  sourceId: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  createdByRole: { type: String, default: '' },
  salePrice: { type: Number, default: 0 },
  costPrice: { type: Number, default: 0 },
  totalRetailValue: { type: Number, default: 0 },
  totalCostValue: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

inventoryMovementSchema.index({ createdAt: -1 });
inventoryMovementSchema.index({ productId: 1, variantName: 1, createdAt: -1 });
inventoryMovementSchema.index({ location: 1, movementType: 1, createdAt: -1 });
inventoryMovementSchema.index({ sourceType: 1, sourceId: 1 });

inventoryMovementSchema.statics.record = function record(data, session = null) {
  const quantityChange = Number(data.quantityChange) || 0;
  const currentStockBefore = Number(data.currentStockBefore) || 0;
  const salePrice = Number(data.salePrice) || 0;
  const costPrice = Number(data.costPrice) || 0;
  const doc = {
    ...data,
    quantityChange,
    currentStockBefore,
    currentStockAfter: currentStockBefore + quantityChange,
    salePrice,
    costPrice,
    totalRetailValue: Math.abs(quantityChange) * salePrice,
    totalCostValue: Math.abs(quantityChange) * costPrice,
  };

  return this.create([doc], session ? { session } : {}).then(([movement]) => movement);
};

export default mongoose.model('InventoryMovement', inventoryMovementSchema);
