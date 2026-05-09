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
}, { timestamps: true });

export default mongoose.model('SiteSettings', siteSettingsSchema);