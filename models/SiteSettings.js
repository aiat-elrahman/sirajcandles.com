import mongoose from 'mongoose';

const dynamicSectionItemSchema = new mongoose.Schema({
  icon:      { type: String, default: '' },  // emoji or short icon text, for trust/why_siraj items
  label:     { type: String, default: '' },  // trust/why_siraj item label
  imageUrl:  { type: String, default: '' },  // instagram item image / trust item uploaded icon
  link:      { type: String, default: '' },  // instagram item link (or any item's click-through)
  quote:     { type: String, default: '' },  // review item text
  author:    { type: String, default: '' },  // review item author name
  rating:    { type: Number, default: 5 },   // review item star rating
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null }, // hand-picked bestseller
}, { _id: false });

const dynamicSectionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: [
      'trust', 'about', 'collections', 'bestsellers', 
      'why_siraj', 'reviews', 'bundle_promo', 'scents', 
      'instagram', 'final_cta', 'custom_text_image'
    ], 
    required: true 
  },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  headline: { type: String, default: '' },
  subheadline: { type: String, default: '' },
  bodyText: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  imageAlignment: { type: String, enum: ['left', 'right', 'center', 'background', 'grid'], default: 'center' },
  buttonText: { type: String, default: '' },
  buttonLink: { type: String, default: '' },
  backgroundColor: { type: String, default: 'transparent' },
  // NEW: repeatable sub-items, used by trust/why_siraj (icons), instagram (images), reviews (quotes)
  items: { type: [dynamicSectionItemSchema], default: [] },
}, { _id: true });

const siteSettingsSchema = new mongoose.Schema({
  faviconUrl: { type: String, default: '' },
  homepageSections: [dynamicSectionSchema],

  // NEW: Tracking & Analytics IDs for the Media Buyer
  metaPixelId: { type: String, default: '' },
  googleAnalyticsId: { type: String, default: '' },

  // Meta Conversions API (server-side events). The token is a SECRET: select:false means
  // it is never returned by any normal query, so it can't leak through the public settings
  // endpoint. Only code that explicitly asks for '+metaCapiToken' can read it.
  metaCapiToken:     { type: String, default: '', select: false },
  metaTestEventCode: { type: String, default: '' },     // from Events Manager > Test Events; empty = live events
  metaApiVersion:    { type: String, default: 'v23.0' }, // Graph API version, editable when Meta retires one

  // Checkout payment: deposit first, balance after the shipping-label photo. All admin-editable.
  payment: {
    depositEnabled:     { type: Boolean, default: true },
    instapayNumber:     { type: String, default: '' },   // where customers send the deposit
    instapayAccountName:{ type: String, default: '' },
    depositType:        { type: String, enum: ['percent', 'fixed'], default: 'percent' },
    depositValue:       { type: Number, default: 50 },   // % of the order total, or a fixed EGP amount
    policyHeading:      { type: String, default: 'How payment works' },
    policyText:         { type: String, default: '' },   // shown before the Place Order button
    acknowledgeLabel:   { type: String, default: 'I have read and agree to the payment and shipping terms' },
    successMessage:     { type: String, default: '' },   // shown on the order-confirmed screen
  },

  // Announcement ribbon
  ribbonEnabled: { type: Boolean, default: true },
  ribbonMessages: [{ type: String }],
  ribbonSpeed: { type: Number, default: 4000 }, 

  // Nav link visibility
  navLinks: {
    home:      { type: Boolean, default: true },
    products:  { type: Boolean, default: true },
    bundles:   { type: Boolean, default: true },
    trackOrder:{ type: Boolean, default: true },
    stores:    { type: Boolean, default: false }, 
  },

  // Footer
  footerEmail:   { type: String, default: 'orders@sirajcandles.com' },
  footerTagline: { type: String, default: 'From our Home to Yours ❤️' },
  footerCopyright: { type: String, default: '© 2025 Siraj Candles. All rights reserved.' },
  footerInstagram: { type: String, default: 'https://www.instagram.com/siraj_candles_eg' },
  footerFacebook:  { type: String, default: 'https://www.facebook.com/people/sirajcandles/61576576972784/' },
  footerTiktok:    { type: String, default: 'https://www.tiktok.com/@sirajcandles' },

  // NEW: Footer policy/info links (Terms & Conditions, Shipping, Returns, FAQ, etc.)
  footerLinks: {
    type: [{ label: { type: String, default: '' }, url: { type: String, default: '' } }],
    default: [
      { label: 'FAQ', url: '/page.html?slug=faq' },
      { label: 'Shipping & Delivery', url: '/page.html?slug=shipping' },
      { label: 'Returns & Refunds', url: '/page.html?slug=returns' },
      { label: 'Terms & Conditions', url: '/page.html?slug=terms' },
    ],
  },

  whatsappOrderTemplate: {
    type: String,
    default: `هاي {{name}} 🤍
أهلا بيكي في Siraj family ✨
اتبسطنا جدا انك حبيتي تجربي منتجاتنا ونتمني يعجبك 🌷
اوردرك برقم {{orderId}}

Total: {{total}} EGP

لتأكيد الاوردر برجاء تحويل ديبوزت علي رقم
الـ Instapay:
{{instapayNumber}}
بإسم {{instapayName}}
ابعتلنا سكرين شوت أو تأكيد التحويل هنا على الواتساب 😊

الشحن هيبقي عن طريق البريد المصري.
ملحوظة بسيطة: البريد المصري لا يوفر خدمة الدفع عند الاستلام، لذلك بعد ما نبعتلك تفاصيل الشحنة هيكون المطلوب تحويل المبلغ المتبقي عن طريق Instapay أو wallet الأنسب ليكي.

متحمسين جدًا يوصل طلبك وتجربي منتجات Siraj 🤍✨
ولو عندك أي سؤال إحنا موجودين في أي وقت.`,
  },

  whatsappPhone: { type: String, default: '' },

  freeGift: {
    enabled:  { type: Boolean, default: false },
    threshold: { type: Number, default: 500 },
    giftProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
}, { timestamps: true });

export default mongoose.model('SiteSettings', siteSettingsSchema);