// routes/discountRoutes.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// ─── Discount Schema ──────────────────────────────────────────────────────────
const discountSchema = new mongoose.Schema({
    code:          { type: String, required: true, unique: true, uppercase: true, trim: true },
    type:          { type: String, enum: ['percentage', 'fixed', 'free_shipping'], required: true },
    value:         { type: Number, default: 0 },
    appliesTo:     { type: String, enum: ['entire', 'categories'], default: 'entire' },
    categories:    [{ type: String }],
    minOrderValue: { type: Number, default: 0 },
    maxUses:       { type: Number, default: null },   // null = unlimited
    usedCount:     { type: Number, default: 0 },
    expiresAt:     { type: Date, default: null },     // null = no expiry
    status:        { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

const Discount = mongoose.models.Discount || mongoose.model('Discount', discountSchema);

// ─── GET all discounts ────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const discounts = await Discount.find().sort({ createdAt: -1 });
        res.json(discounts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST create discount ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const discount = new Discount(req.body);
        const saved = await discount.save();
        res.status(201).json(saved);
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Discount code already exists.' });
        }
        res.status(400).json({ message: err.message });
    }
});

// ─── PUT update discount ──────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const updated = await Discount.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ message: 'Discount not found' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// ─── DELETE discount ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Discount.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Discount not found' });
        res.json({ message: 'Discount deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ─── POST /validate — used by frontend checkout ───────────────────────────────
//
// Request body:
//   { code, cartTotal, cartItems: [{ category, price, quantity }] }
//
// Response (valid):
//   { valid: true, discount: {...}, discountAmount, message }
//
// Response (invalid):
//   { valid: false, message }
//
router.post('/validate', async (req, res) => {
    try {
        const { code, cartTotal, cartItems = [] } = req.body;

        if (!code) return res.status(400).json({ valid: false, message: 'No code provided.' });

        // 1. Find the discount
        const discount = await Discount.findOne({ code: code.toUpperCase().trim() });
        if (!discount) return res.json({ valid: false, message: 'Invalid discount code.' });

        // 2. Check active status
        if (discount.status !== 'active') {
            return res.json({ valid: false, message: 'This discount code is not active.' });
        }

        // 3. Check expiry
        if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) {
            return res.json({ valid: false, message: 'This discount code has expired.' });
        }

        // 4. Check usage limit
        if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
            return res.json({ valid: false, message: 'This discount code has reached its usage limit.' });
        }

        // 5. Check minimum order value (against full cart total)
        if (discount.minOrderValue > 0 && cartTotal < discount.minOrderValue) {
            return res.json({
                valid: false,
                message: `Minimum order of ${discount.minOrderValue} EGP required for this code.`
            });
        }

        // 6. Calculate discount amount
        let discountAmount = 0;
        let applicableTotal = cartTotal;

        if (discount.appliesTo === 'categories' && discount.categories.length > 0) {
            // Sum only the cart items that belong to the specified categories
            applicableTotal = cartItems.reduce((sum, item) => {
                const inCategory = discount.categories.some(
                    cat => cat.toLowerCase() === (item.category || '').toLowerCase()
                );
                return inCategory ? sum + (item.price * item.quantity) : sum;
            }, 0);

            if (applicableTotal === 0) {
                return res.json({
                    valid: false,
                    message: `This code only applies to: ${discount.categories.join(', ')}. None of your cart items qualify.`
                });
            }
        }

        if (discount.type === 'percentage') {
            discountAmount = applicableTotal * (discount.value / 100);
        } else if (discount.type === 'fixed') {
            discountAmount = Math.min(discount.value, applicableTotal); // Can't discount more than applicable total
        } else if (discount.type === 'free_shipping') {
            discountAmount = 0; // Handled separately by frontend — just flag it
        }

        // Round to 2 decimal places
        discountAmount = Math.round(discountAmount * 100) / 100;

        // 7. Build a friendly message for the customer
        let appliedMessage = '';
        if (discount.type === 'free_shipping') {
            appliedMessage = '🚚 Free shipping applied!';
        } else if (discount.appliesTo === 'categories') {
            appliedMessage = `✅ ${discount.value}${discount.type === 'percentage' ? '%' : ' EGP'} off your ${discount.categories.join(' & ')} items — saving ${discountAmount.toFixed(2)} EGP`;
        } else {
            appliedMessage = `✅ ${discount.code} applied — saving ${discountAmount.toFixed(2)} EGP`;
        }

        res.json({
            valid: true,
            discount: {
                _id: discount._id,
                code: discount.code,
                type: discount.type,
                value: discount.value,
                appliesTo: discount.appliesTo,
                categories: discount.categories,
                isFreeShipping: discount.type === 'free_shipping'
            },
            discountAmount,
            applicableTotal,
            message: appliedMessage
        });

    } catch (err) {
        console.error('Discount validation error:', err);
        res.status(500).json({ valid: false, message: 'Server error validating discount.' });
    }
});

// ─── POST /use — increment usedCount after a successful order ─────────────────
// Call this from your order creation route after order is saved
router.post('/use', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ message: 'No code provided' });

        await Discount.findOneAndUpdate(
            { code: code.toUpperCase() },
            { $inc: { usedCount: 1 } }
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;