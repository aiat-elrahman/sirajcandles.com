import express from 'express';
import PageContent from '../models/PageContent.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Starter text, written to the database the first time a page is opened (or listed by the
// admin). From then on the database copy is the source of truth and is edited in
// Admin > Store Settings > Policy pages. Plain text; a blank line starts a new paragraph.
const DEFAULT_PAGES = {
  faq: {
    title: 'FAQ',
    summary: 'Quick answers to the questions we hear most.',
    body: `How do I order?
Add your items to the cart and place your order. We then message you on WhatsApp to confirm the details and send the payment instructions.

How does payment work?
We do not offer cash on delivery. A deposit is paid first by InstaPay to confirm your order. Once your parcel is packed we send you a photo of the shipping label, and you pay the remaining balance before it is dispatched. The exact deposit and payment details are shown at checkout before you place your order.

How is my order delivered?
By Egyptian Post (Barid Masri). Delivery times depend on your city and are confirmed when we message you.

Can I change or cancel my order?
Yes, as long as it has not been shipped. Message us on WhatsApp as soon as possible with your order number.

How do I track my order?
Use the Track Order page with the phone number you ordered with.

How should I care for my candle?
Trim the wick to about 5 mm before each burn and let the wax melt to the edges the first time you light it. Never leave a burning candle unattended.`,
  },
  shipping: {
    title: 'Shipping & Delivery',
    summary: 'How we ship, how long it takes, and how the payment steps fit in.',
    body: `We ship across Egypt with Egyptian Post (Barid Masri).

Because Egyptian Post does not offer cash on delivery for our parcels, we do not accept cash on delivery. Payment is done in two steps:

1. Deposit. After you place your order, send the deposit by InstaPay to the number shown at checkout. Your order is confirmed once we receive it.

2. Balance. When your parcel is ready we send you a photo of the shipping label. You then transfer the remaining balance by InstaPay or a mobile wallet, and we dispatch the parcel.

Shipping fees are shown at checkout and depend on your city. Delivery times are confirmed when we contact you about your order.

Please make sure your name, phone number and address are complete and correct, since the post office needs them to deliver your parcel. If a parcel is returned to us because of an incorrect address or because it was not collected, we will contact you about re-sending it and any extra shipping cost.`,
  },
  returns: {
    title: 'Returns & Refunds',
    summary: 'What to do if something is wrong with your order.',
    body: `We handcraft every product in small batches and we want you to be happy with your order.

Damaged or wrong items
If your order arrives damaged or you received the wrong item, message us on WhatsApp within 48 hours of receiving it, with your order number and clear photos of the item and the packaging. We will replace the item or refund you.

Changes of mind
Because our products are handmade and often made to order, and because candles, wax melts and skin-care products cannot be resold once they have left us, we cannot accept returns for a change of mind or for opened products.

Custom and personalised orders
Custom and personalised orders are made specially for you and cannot be returned or refunded unless they arrive damaged.

How refunds work
Approved refunds are sent back by InstaPay or mobile wallet to the account the payment came from. Deposits are refunded if we are unable to fulfil your order.

Cancelling an order
You can cancel before your order is shipped. Message us on WhatsApp with your order number.`,
  },
  terms: {
    title: 'Terms & Conditions',
    summary: 'The terms that apply when you order from Siraj Candles.',
    body: `By placing an order on this website you agree to the terms below.

Orders
An order is confirmed only after we contact you and receive the deposit. We may decline or cancel an order, for example when an item is out of stock, and any deposit already paid will be refunded.

Prices and payment
Prices are in Egyptian pounds (EGP). We do not accept cash on delivery. A deposit is paid first by InstaPay; the balance is paid after we send you the shipping label photo and before the parcel is dispatched.

Delivery
We deliver with Egyptian Post. Delivery times are estimates and can be affected by the post office.

Returns
Please read our Returns & Refunds page, which forms part of these terms.

Product information
Our products are handmade, so slight differences in colour, shape and finish are normal. Scent strength is personal and varies from person to person.

Safe use
Candles and wax melts must be used according to the care instructions provided and never left unattended. Keep them away from children and pets.

Contact
Questions about these terms? Message us on WhatsApp or email us using the address in the footer of this website.`,
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'What we collect, why, and how we use it.',
    body: `This page explains how Siraj Candles handles your information.

What we collect
When you order we collect your name, phone number, email, address and the items you ordered, so that we can confirm, pack and deliver your order and contact you about it.

Analytics and advertising
We use tools such as the Meta Pixel and Google Analytics to understand how people use this website and to measure our advertising. These tools use cookies and similar technologies, and may receive information about your visits and purchases. Where we share order information with Meta to measure our ads, details such as your email and phone number are sent in a hashed (scrambled) form.

How we use your information
We use it to process and deliver orders, to contact you about them, to improve our website and to measure our advertising. We do not sell your personal information.

Who sees it
Only our team, and the services we use to run the shop (for example hosting, delivery and messaging), see your information.

Your choices
You can ask us to correct or delete your information by contacting us on WhatsApp or by email. You can also block cookies in your browser settings.`,
  },
};

const SLUGS = Object.keys(DEFAULT_PAGES);

// Make sure the five standard pages exist in the database.
async function ensureDefaults() {
  for (const slug of SLUGS) {
    const exists = await PageContent.findOne({ slug });
    if (!exists) {
      try { await PageContent.create({ slug, ...DEFAULT_PAGES[slug], isPublished: true }); }
      catch (err) { if (err.code !== 11000) throw err; }   // another request created it first
    }
  }
}

// ADMIN: list every page (creates the standard ones on first use)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await ensureDefaults();
    const pages = await PageContent.find().sort({ slug: 1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUBLIC: one published page by slug
router.get('/:slug', async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase();
    let page = await PageContent.findOne({ slug });
    if (!page && DEFAULT_PAGES[slug]) {
      try { page = await PageContent.create({ slug, ...DEFAULT_PAGES[slug], isPublished: true }); }
      catch (err) { if (err.code === 11000) page = await PageContent.findOne({ slug }); else throw err; }
    }
    if (!page || !page.isPublished) return res.status(404).json({ message: 'Page not found' });
    res.json(page);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ADMIN: create or update a page by slug
router.put('/:slug', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const slug = String(req.params.slug || '').toLowerCase().trim();
    if (!/^[a-z0-9-]+$/.test(slug)) return res.status(400).json({ message: 'Slug may only contain lowercase letters, numbers and dashes.' });
    const { title, summary, body, isPublished } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ message: 'A page title is required.' });
    const page = await PageContent.findOneAndUpdate(
      { slug },
      { slug, title: String(title).trim(), summary: summary || '', body: body || '', isPublished: isPublished !== false, updatedBy: req.user?.username || '' },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(page);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

export default router;