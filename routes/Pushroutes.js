import express from 'express';
import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// POST /api/push/subscribe — save (or update) a device subscription. Called by
// push-init.js after the admin grants notification permission.
router.post('/subscribe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        createdBy: req.user?.username || '',
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});

// DELETE /api/push/subscribe — remove a device subscription (e.g. on admin logout)
router.delete('/subscribe', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    await PushSubscription.deleteOne({ endpoint });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove subscription' });
  }
});

// POST /api/push/test — send a test notification to every subscribed device
router.post('/test', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const sent = await sendPushToAll({
      title: 'Siraj Candles',
      body: 'Test notification — push is working! 🎉',
      url: '/admin-upload',
    });
    res.json({ success: true, sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reusable helper — import this into OrderController.js (or anywhere else) and
// call it whenever a new order/event should notify the team, e.g.:
//   import { sendPushToAll } from '../routes/pushRoutes.js';
//   await sendPushToAll({ title: 'New Order! 🎉', body: `${name} — ${total} EGP`, url: '/admin-upload' });
export async function sendPushToAll(payload) {
  const subscriptions = await PushSubscription.find();
  const notificationPayload = JSON.stringify(payload);

  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        notificationPayload
      );
      sent++;
    } catch (err) {
      // Subscription expired or was revoked on the device — clean it up
      if (err.statusCode === 410 || err.statusCode === 404) {
        await PushSubscription.deleteOne({ endpoint: sub.endpoint });
      } else {
        console.error('Push send error:', err.message);
      }
    }
  }));

  return sent;
}

export default router;