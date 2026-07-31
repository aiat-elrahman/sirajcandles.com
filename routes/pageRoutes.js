import express from 'express';
import PageContent from '../models/PageContent.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const DEFAULT_PAGES = {
  faq: {
    title: 'FAQ',
    summary: 'Quick answers about ordering from Siraj Candles.',
    body: `Frequently Asked Questions

How do I place an order?
You can add products to your cart, continue to checkout, and submit your delivery details. We will contact you if any clarification is needed.

How long does delivery take?
Delivery timing depends on your city and courier availability. Most orders are prepared as soon as possible after confirmation.

Can I request a customized gift?
Yes. Contact us before placing the order so we can confirm timing, scent availability, and packaging details.

Are all products handmade?
Siraj Candles products are prepared in small batches. Slight differences in color, texture, or finish may happen and are part of the handmade character.`,
  },
  shipping: {
    title: 'Shipping & Delivery',
    summary: 'General delivery information for Siraj Candles orders.',
    body: `Shipping & Delivery Policy

Delivery Areas
We deliver to supported areas shown at checkout. If your area is not listed, contact us before ordering.

Processing Time
Orders are usually prepared after confirmation. Custom or large orders may need extra time.

Delivery Fees
Delivery fees are calculated at checkout based on city or area. Free delivery may apply when an active offer is available.

Failed Delivery
Please make sure your phone number and address are correct. If the courier cannot reach you, delivery may be delayed or cancelled.`,
  },
  returns: {
    title: 'Returns & Refunds',
    summary: 'General return, exchange, and refund guidance.',
    body: `Returns & Refunds Policy

Damaged or Wrong Items
If you receive a damaged or incorrect item, contact us as soon as possible with your order number and photos.

Returns
Because candles, scents, and self-care products are personal-use items, returns may be limited once the product is opened or used.

Exchanges
Exchange requests are reviewed case by case depending on product condition and availability.

Refunds
Approved refunds are handled using the original or agreed payment method. Processing time may vary by payment provider.`,
  },
  terms: {
    title: 'Terms & Conditions',
    summary: 'General terms for using the Siraj Candles website.',
    body: `Terms & Conditions

Website Use
By using this website or placing an order, you agree to provide accurate information and use the website only for lawful purposes.

Product Information
We try to keep product details, prices, and stock accurate. Small differences in handmade products may occur.

Orders
Submitting an order does not guarantee acceptance if an item is unavailable, the price is incorrect, or delivery cannot be completed.

Changes
Siraj Candles may update these terms from time to time. The latest version shown on the website applies.`,
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'How customer information is used by Siraj Candles.',
    body: `Privacy Policy

Information We Collect
We collect the information needed to process your order, such as name, phone number, email, delivery address, and order details.

How We Use Information
We use your information to confirm orders, deliver products, provide customer support, and improve our service.

Sharing Information
We may share delivery details with couriers or service providers only as needed to complete your order.

Contact
If you want to update or ask about your information, contact Siraj Candles through the official contact channels shown on the website.`,
  },
};

const normalizeSlug = value => String(value || '').trim().toLowerCase().replace(/\.html$/, '');

async function getOrCreateDefaultPage(slug) {
  let page = await PageContent.findOne({ slug });
  if (page) return page;

  const fallback = DEFAULT_PAGES[slug];
  if (!fallback) return null;

  return PageContent.create({ slug, ...fallback });
}

router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await Promise.all(Object.keys(DEFAULT_PAGES).map(getOrCreateDefaultPage));
    const pages = await PageContent.find().sort({ slug: 1 });
    res.json(pages);
  } catch (err) {
    console.error('GET /api/pages error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const page = await getOrCreateDefaultPage(slug);
    if (!page || !page.isPublished) return res.status(404).json({ message: 'Page not found.' });
    res.json(page);
  } catch (err) {
    console.error('GET /api/pages/:slug error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.put('/:slug', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const slug = normalizeSlug(req.params.slug);
    const { title, summary, body, isPublished } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ message: 'Title is required.' });
    }

    const page = await PageContent.findOneAndUpdate(
      { slug },
      {
        slug,
        title: title.trim(),
        summary: summary || '',
        body: body || '',
        isPublished: isPublished !== false,
        updatedBy: req.user?.username || '',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, page });
  } catch (err) {
    console.error('PUT /api/pages/:slug error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
