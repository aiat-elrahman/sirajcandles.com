import mongoose from 'mongoose';

const siteSettingsSchema = new mongoose.Schema({
  // Announcement ribbon
  ribbonEnabled: { type: Boolean, default: true },
  ribbonMessages: [{ type: String }],
  ribbonSpeed: { type: Number, default: 4000 }, // ms per message

  // Nav link visibility
  navLinks: {
    home:      { type: Boolean, default: true },
    products:  { type: Boolean, default: true },
    bundles:   { type: Boolean, default: true },
    trackOrder:{ type: Boolean, default: true },
    stores:    { type: Boolean, default: false }, // hidden until you activate
  },

  // Footer
  footerEmail:   { type: String, default: 'orders@sirajcandles.com' },
  footerTagline: { type: String, default: 'From our Home to Yours ❤️' },
  footerCopyright: { type: String, default: '© 2025 Siraj Candles. All rights reserved.' },
  footerInstagram: { type: String, default: 'https://www.instagram.com/siraj_candles_eg' },
  footerFacebook:  { type: String, default: 'https://www.facebook.com/people/sirajcandles/61576576972784/' },
  footerTiktok:    { type: String, default: 'https://www.tiktok.com/@sirajcandles' },

  // WhatsApp order confirmation message template
  // Supports placeholders: {{name}}, {{orderId}}, {{total}}, {{items}}, {{city}}
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

  // WhatsApp business number (yours) — used to open the chat
  whatsappPhone: { type: String, default: '+201001775793' },
}, { timestamps: true });

export default mongoose.model('SiteSettings', siteSettingsSchema);