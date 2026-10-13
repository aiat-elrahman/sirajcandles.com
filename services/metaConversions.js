import crypto from 'crypto';
import SiteSettings from '../models/SiteSettings.js';

// Meta wants personal data lower-cased, trimmed and SHA-256 hashed.
const sha256 = (v) => crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex');

// Egyptian numbers: 01001234567 -> 201001234567 (country code, digits only).
const normalizePhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '20' + d.slice(1);
  return d;
};

const clientIp = (req) => {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
};

/**
 * Sends a server-side Purchase event to Meta's Conversions API.
 * Safe by design: it never throws, never blocks the order, and does nothing unless a
 * Pixel ID and access token are saved in Admin > Store Settings.
 *
 * `eventId` MUST equal the eventID the browser pixel sends for the same purchase
 * (we use the order id) — that is how Meta merges the two copies into one.
 */
export async function sendMetaPurchase({ req, order, tracking = {} }) {
  try {
    const s = await SiteSettings.findOne().sort({ updatedAt: -1 })
      .select('+metaCapiToken metaPixelId metaTestEventCode metaApiVersion');
    if (!s || !s.metaPixelId || !s.metaCapiToken) return { skipped: 'not configured' };

    const info = order.customerInfo || {};
    const nameParts = String(info.name || '').trim().split(/\s+/).filter(Boolean);
    const user_data = {
      client_ip_address: clientIp(req),
      client_user_agent: req.headers['user-agent'] || '',
      country: [sha256('eg')],
    };
    if (info.email) user_data.em = [sha256(info.email)];
    const phone = normalizePhone(info.phone);
    if (phone) user_data.ph = [sha256(phone)];
    if (nameParts[0]) user_data.fn = [sha256(nameParts[0])];
    if (nameParts.length > 1) user_data.ln = [sha256(nameParts[nameParts.length - 1])];
    if (info.city) user_data.ct = [sha256(String(info.city).replace(/\s+/g, ''))];
    if (order._id) user_data.external_id = [sha256(order._id.toString())];
    if (tracking.fbp) user_data.fbp = String(tracking.fbp);
    if (tracking.fbc) user_data.fbc = String(tracking.fbc);

    const items = order.items || [];
    const event = {
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: order._id.toString(),
      event_source_url: tracking.sourceUrl || undefined,
      action_source: 'website',
      user_data,
      custom_data: {
        value: Number(order.totalAmount || 0),
        currency: 'EGP',
        content_type: 'product',
        content_ids: items.map(i => String(i.productId)).filter(Boolean),
        contents: items.map(i => ({ id: String(i.productId), quantity: Number(i.quantity || 1), item_price: Number(i.price || 0) })),
        num_items: items.reduce((n, i) => n + Number(i.quantity || 0), 0),
        order_id: order._id.toString(),
      },
    };

    const version = s.metaApiVersion || 'v23.0';
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(s.metaPixelId)}/events`;
    const body = { data: [event], access_token: s.metaCapiToken };
    if (s.metaTestEventCode) body.test_event_code = s.metaTestEventCode;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Log Meta's reason, never the token.
      console.error('Meta CAPI rejected the event:', res.status, JSON.stringify(json?.error || json));
      return { ok: false, status: res.status };
    }
    return { ok: true, eventsReceived: json.events_received };
  } catch (err) {
    console.error('Meta CAPI error:', err.message);
    return { ok: false };
  }
}