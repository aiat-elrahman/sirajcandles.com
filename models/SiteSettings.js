import mongoose from 'mongoose';

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
  backgroundColor: { type: String, default: 'transparent' } 
}, { _id: true });

const siteSettingsSchema = new mongoose.Schema({
  faviconUrl: { type: String, default: '' },
  homepageSections: [dynamicSectionSchema],

  // NEW: Tracking & Analytics IDs for the Media Buyer
  metaPixelId: { type: String, default: '' },
  googleAnalyticsId: { type: String, default: '' },

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

  whatsappOrderTemplate: {
    type: String,
    default: `هاي {{name}} 🤍
أهلا بيكي في Siraj family ✨
اتبسطنا جدا انك حبيتي تجربي منتجاتنا ونتمني يعجبك 🌷
اوردرك برقم {{orderId}}

Total: {{total}} EGP

لتأكيد الاوردر برجاء تحويل ديبوزت علي رقم
الـ Instapay:
[+201001775793]
بإسم مروه احمد
ابعتلنا سكرين شوت أو تأكيد التحويل هنا على الواتساب 😊

الشحن هيبقي عن طريق البريد المصري.
ملحوظة بسيطة: البريد المصري لا يوفر خدمة الدفع عند الاستلام، لذلك بعد ما نبعتلك تفاصيل الشحنة هيكون المطلوب تحويل المبلغ المتبقي عن طريق Instapay أو wallet الأنسب ليكي.

متحمسين جدًا يوصل طلبك وتجربي منتجات Siraj 🤍✨
ولو عندك أي سؤال إحنا موجودين في أي وقت.`,
  },

  whatsappPhone: { type: String, default: '+201001775793' },

  freeGift: {
    enabled:  { type: Boolean, default: false },
    threshold: { type: Number, default: 500 },
    giftProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
}, { timestamps: true });

export default mongoose.model('SiteSettings', siteSettingsSchema);