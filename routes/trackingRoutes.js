import express from 'express';
import TrackingEvent from '../models/TrackingEvent.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const allowedTypes = new Set(['page_view', 'view_content', 'add_to_cart', 'begin_checkout', 'purchase']);
const safeString = (value, max = 500) => String(value || '').slice(0, max);

router.post('/event', async (req, res) => {
  try {
    const {
      type,
      sessionId,
      path,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      value,
      currency,
      orderId,
      metadata,
    } = req.body || {};

    if (!allowedTypes.has(type)) {
      return res.status(400).json({ message: 'Invalid tracking event type.' });
    }

    if (!sessionId) {
      return res.status(400).json({ message: 'Missing session id.' });
    }

    await TrackingEvent.create({
      type,
      sessionId: safeString(sessionId, 120),
      path: safeString(path, 500),
      referrer: safeString(referrer, 500),
      utmSource: safeString(utmSource, 120),
      utmMedium: safeString(utmMedium, 120),
      utmCampaign: safeString(utmCampaign, 180),
      value: Number(value || 0),
      currency: safeString(currency || 'EGP', 12),
      orderId: safeString(orderId, 120),
      userAgent: safeString(req.get('user-agent'), 500),
      ipAddress: safeString(req.headers['x-forwarded-for'] || req.socket?.remoteAddress, 120),
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error('Tracking event error:', err);
    res.status(500).json({ message: 'Could not record tracking event.' });
  }
});

router.get('/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days || 30), 1), 180);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));

    const events = await TrackingEvent.aggregate([
      { $match: { createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Cairo' } },
            type: '$type',
          },
          count: { $sum: 1 },
          sessions: { $addToSet: '$sessionId' },
          revenue: { $sum: '$value' },
        },
      },
      { $sort: { '_id.day': 1 } },
    ]);

    const byDay = new Map();
    for (const row of events) {
      const day = row._id.day;
      if (!byDay.has(day)) {
        byDay.set(day, {
          date: day,
          pageViews: 0,
          uniqueVisitors: 0,
          viewContent: 0,
          addToCart: 0,
          beginCheckout: 0,
          purchases: 0,
          revenue: 0,
          conversionRate: 0,
        });
      }

      const target = byDay.get(day);
      if (row._id.type === 'page_view') {
        target.pageViews = row.count;
        target.uniqueVisitors = row.sessions.length;
      } else if (row._id.type === 'view_content') {
        target.viewContent = row.count;
      } else if (row._id.type === 'add_to_cart') {
        target.addToCart = row.count;
      } else if (row._id.type === 'begin_checkout') {
        target.beginCheckout = row.count;
      } else if (row._id.type === 'purchase') {
        target.purchases = row.count;
        target.revenue = row.revenue;
      }
    }

    const daily = Array.from(byDay.values()).map(day => ({
      ...day,
      conversionRate: day.uniqueVisitors ? Number(((day.purchases / day.uniqueVisitors) * 100).toFixed(2)) : 0,
    }));

    const totals = daily.reduce(
      (sum, day) => ({
        pageViews: sum.pageViews + day.pageViews,
        uniqueVisitors: sum.uniqueVisitors + day.uniqueVisitors,
        viewContent: sum.viewContent + day.viewContent,
        addToCart: sum.addToCart + day.addToCart,
        beginCheckout: sum.beginCheckout + day.beginCheckout,
        purchases: sum.purchases + day.purchases,
        revenue: sum.revenue + day.revenue,
      }),
      { pageViews: 0, uniqueVisitors: 0, viewContent: 0, addToCart: 0, beginCheckout: 0, purchases: 0, revenue: 0 }
    );

    res.json({
      days,
      daily,
      totals: {
        ...totals,
        conversionRate: totals.uniqueVisitors ? Number(((totals.purchases / totals.uniqueVisitors) * 100).toFixed(2)) : 0,
      },
    });
  } catch (err) {
    console.error('Tracking summary error:', err);
    res.status(500).json({ message: 'Could not load tracking summary.' });
  }
});

export default router;
