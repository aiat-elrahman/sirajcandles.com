// routes/discountRoutes.js
import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

const discountSchema = new mongoose.Schema({
    code:              { type: String, required: true, unique: true, uppercase: true, trim: true },
    type:              { type: String, enum: ['percentage', 'fixed', 'free_shipping', 'buyxgety'], required: true },
    value:             { type: Number, default: 0 },
    appliesTo:         { type: String, enum: ['entire', 'categories'], default: 'entire' },
    categories:        [{ type: String }],
    minOrderValue:     { type: Number, default: 0 },
    maxUses:           { type: Number, default: null },
    usedCount:         { type: Number, default: 0 },
    expiresAt:         { type: Date, default: null },
    status:            { type: String, enum: ['active', 'inactive'], default: 'active' },
    // Auto-apply
    isAutomatic:       { type: Boolean, default: false },
    // Stacking
    isStackable:       { type: Boolean, default: false },
    stackCap:          { type: Number, default: 30 },
    // Buy X Get Y
    buyQuantity:       { type: Number, default: 2 },
    getQuantity:       { type: Number, default: 1 },
    getDiscountPct:    { type: Number, default: 100 },
    buyxgetyCategory:  { type: String, default: '' },
}, { timestamps: true });

const Discount = mongoose.models.Discount || mongoose.model('Discount', discountSchema);

// GET all
router.get('/', async (req, res) => {
    try {
        res.json(await Discount.find().sort({ createdAt: -1 }));
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET automatic discounts only (called on cart load)
router.get('/automatic', async (req, res) => {
    try {
        const now = new Date();
        const discounts = await Discount.find({
            isAutomatic: true,
            status: 'active',
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
        });
        res.json(discounts);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create
router.post('/', async (req, res) => {
    try {
        const discount = new Discount(req.body);
        res.status(201).json(await discount.save());
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ message: 'Discount code already exists.' });
        res.status(400).json({ message: err.message });
    }
});

// PUT update
router.put('/:id', async (req, res) => {
    try {
        const updated = await Discount.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updated) return res.status(404).json({ message: 'Not found' });
        res.json(updated);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Discount.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Not found' });
        res.json({ message: 'Deleted' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Core discount calculation helper ─────────────────────────────────────────
function calculateDiscount(discount, cartTotal, cartItems) {
    let discountAmount = 0;
    let freeShipping = false;
    let details = '';

    if (discount.type === 'free_shipping') {
        freeShipping = true;
        details = '🚚 Free shipping applied!';
        return { discountAmount: 0, freeShipping, details };
    }

    if (discount.type === 'buyxgety') {
        const cat = discount.buyxgetyCategory;
        const qualifying = cartItems
            .filter(i => cat === 'all' || (i.category||'').toLowerCase() === cat.toLowerCase())
            .flatMap(i => Array(i.quantity).fill(i.price))
            .sort((a, b) => a - b); // ascending — cheapest first

        const totalNeeded = parseInt(discount.buyQuantity) + parseInt(discount.getQuantity);
        if (qualifying.length < totalNeeded) {
            return { valid: false, message: `Add ${totalNeeded - qualifying.length} more ${cat === 'all' ? '' : cat} item(s) to qualify for this deal.` };
        }

        // Discount applies to the cheapest N items
        const discountedItems = qualifying.slice(0, discount.getQuantity);
        discountAmount = discountedItems.reduce((s, price) => s + price * (discount.getDiscountPct / 100), 0);
        discountAmount = Math.round(discountAmount * 100) / 100;
        details = `🎁 Buy ${discount.buyQuantity} Get ${discount.getQuantity} deal — saving ${discountAmount.toFixed(2)} EGP`;
        return { discountAmount, freeShipping, details };
    }

    // percentage or fixed
    let applicableTotal = cartTotal;
    if (discount.appliesTo === 'categories' && discount.categories.length > 0) {
        applicableTotal = cartItems.reduce((sum, item) => {
            const match = discount.categories.some(c => c.toLowerCase() === (item.category||'').toLowerCase());
            return match ? sum + (item.price * item.quantity) : sum;
        }, 0);
        if (applicableTotal === 0) {
            return { valid: false, message: `This code only applies to: ${discount.categories.join(', ')}. None of your cart items qualify.` };
        }
    }

    if (discount.type === 'percentage') {
        discountAmount = applicableTotal * (discount.value / 100);
    } else {
        discountAmount = Math.min(discount.value, applicableTotal);
    }
    discountAmount = Math.round(discountAmount * 100) / 100;

    const scope = discount.appliesTo === 'categories' ? ` on ${discount.categories.join(' & ')}` : '';
    details = `✅ ${discount.value}${discount.type === 'percentage' ? '%' : ' EGP'} off${scope} — saving ${discountAmount.toFixed(2)} EGP`;
    return { discountAmount, freeShipping, details };
}

// ── POST /validate (code-based) ───────────────────────────────────────────────
router.post('/validate', async (req, res) => {
    try {
        const { code, cartTotal, cartItems = [], appliedDiscounts = [] } = req.body;
        if (!code) return res.status(400).json({ valid: false, message: 'No code provided.' });

        const discount = await Discount.findOne({ code: code.toUpperCase().trim() });
        if (!discount) return res.json({ valid: false, message: 'Invalid discount code.' });
        if (discount.status !== 'active') return res.json({ valid: false, message: 'This code is not active.' });
        if (discount.expiresAt && new Date(discount.expiresAt) < new Date()) return res.json({ valid: false, message: 'This code has expired.' });
        if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) return res.json({ valid: false, message: 'This code has reached its usage limit.' });
        if (discount.minOrderValue > 0 && cartTotal < discount.minOrderValue) return res.json({ valid: false, message: `Minimum order of ${discount.minOrderValue} EGP required.` });

        // Stacking check
        if (appliedDiscounts.length > 0 && !discount.isStackable) {
            return res.json({ valid: false, message: 'This code cannot be combined with other discounts.' });
        }

        const result = calculateDiscount(discount, cartTotal, cartItems);
        if (result.valid === false) return res.json({ valid: false, message: result.message });

        // Stacking cap check — sequential calculation
        let finalDiscountAmount = result.discountAmount;
        if (appliedDiscounts.length > 0 && discount.isStackable) {
            const existingPct = appliedDiscounts.reduce((s, d) => s + (d.effectivePct || 0), 0);
            const newPct = cartTotal > 0 ? (result.discountAmount / cartTotal) * 100 : 0;
            const combinedPct = existingPct + newPct;
            const cap = discount.stackCap || 30;
            if (combinedPct > cap) {
                // Only apply if this alone is better than existing
                const existingAmount = appliedDiscounts.reduce((s, d) => s + (d.discountAmount || 0), 0);
                if (result.discountAmount <= existingAmount) {
                    return res.json({ valid: false, message: `Combined discount would exceed ${cap}% cap. Your existing discount is already better.` });
                }
                // Replace existing with this one
                finalDiscountAmount = result.discountAmount;
            }
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
                buyxgetyCategory: discount.buyxgetyCategory,
                isFreeShipping: result.freeShipping,
                isStackable: discount.isStackable,
                stackCap: discount.stackCap,
                effectivePct: cartTotal > 0 ? (finalDiscountAmount / cartTotal) * 100 : 0,
            },
            discountAmount: finalDiscountAmount,
            freeShipping: result.freeShipping,
            message: result.details
        });
    } catch (err) {
        console.error('Discount validation error:', err);
        res.status(500).json({ valid: false, message: 'Server error.' });
    }
});

// ── POST /apply-automatic — called on cart load ───────────────────────────────
// Returns all automatic discounts that apply to this cart
router.post('/apply-automatic', async (req, res) => {
    try {
        const { cartTotal, cartItems = [] } = req.body;
        const now = new Date();

        const automatics = await Discount.find({
            isAutomatic: true,
            status: 'active',
            $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
        });

        const applied = [];
        for (const discount of automatics) {
            if (discount.minOrderValue > 0 && cartTotal < discount.minOrderValue) continue;
            if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) continue;

            const result = calculateDiscount(discount, cartTotal, cartItems);
            if (result.valid === false) continue;
            if (result.discountAmount === 0 && !result.freeShipping) continue;

            applied.push({
                _id: discount._id,
                code: discount.code,
                type: discount.type,
                value: discount.value,
                appliesTo: discount.appliesTo,
                categories: discount.categories,
                buyxgetyCategory: discount.buyxgetyCategory,
                isFreeShipping: result.freeShipping,
                isStackable: discount.isStackable,
                stackCap: discount.stackCap,
                discountAmount: result.discountAmount,
                message: result.details,
                effectivePct: cartTotal > 0 ? (result.discountAmount / cartTotal) * 100 : 0,
            });
        }

        // Return the best one (or all if stackable — simplified: return best)
        applied.sort((a, b) => b.discountAmount - a.discountAmount);
        res.json({ applied: applied.slice(0, 1) }); // best automatic discount
    } catch (err) {
        console.error('Auto-discount error:', err);
        res.status(500).json({ applied: [] });
    }
});

// ── POST /use — increment usage after successful order ────────────────────────
router.post('/use', async (req, res) => {
    try {
        const { codes } = req.body; // array of codes used
        if (!codes || !codes.length) return res.json({ success: true });
        await Discount.updateMany(
            { code: { $in: codes.map(c => c.toUpperCase()) } },
            { $inc: { usedCount: 1 } }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

export default router;