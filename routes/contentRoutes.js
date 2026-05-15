import express from 'express';
import jwt from 'jsonwebtoken';
import ContentPlan from '../models/ContentPlan.js';

const router = express.Router();

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE (same logic as server.js,
// copied here so this route file is self-contained
// and doesn't need server.js to export it)
// ─────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Apply auth to every route in this file
router.use(authenticateToken);

// ─────────────────────────────────────────────
// HELPER: standard error response
// ─────────────────────────────────────────────
const serverError = (res, err, context = '') => {
  console.error(`❌ ContentPlan error${context ? ' [' + context + ']' : ''}:`, err.message);
  return res.status(500).json({ error: 'Something went wrong.', details: err.message });
};

// ═══════════════════════════════════════════════════════════════
// GET /api/content?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Fetch all planned days in a date range.
// Default: today → 14 days ahead (two-week view on load).
// The frontend can request a wider range for a monthly view.
// ═══════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Build "14 days from today" as the default end date
    const defaultEnd = new Date();
    defaultEnd.setDate(defaultEnd.getDate() + 14);
    const defaultEndStr = defaultEnd.toISOString().split('T')[0];

    const from = req.query.from || today;
    const to   = req.query.to   || defaultEndStr;

    // Validate format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
    }

    const plans = await ContentPlan.getRange(from, to);
    return res.json({ success: true, plans });
  } catch (err) {
    return serverError(res, err, 'GET /');
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/content/all
//
// Fetch every planned day (no date filter).
// Used to populate the full calendar view.
// ═══════════════════════════════════════════════════════════════
router.get('/all', async (req, res) => {
  try {
    const plans = await ContentPlan.find().sort({ date: 1 });
    return res.json({ success: true, plans });
  } catch (err) {
    return serverError(res, err, 'GET /all');
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/content/:date
//
// Fetch a single day's plan by date string (YYYY-MM-DD).
// Returns 404 if nothing has been planned for that day yet
// so the frontend knows to show the empty state.
// ═══════════════════════════════════════════════════════════════
router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Date must be in YYYY-MM-DD format.' });
    }

    const plan = await ContentPlan.findOne({ date });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'No plan found for this date.' });
    }

    return res.json({ success: true, plan });
  } catch (err) {
    return serverError(res, err, 'GET /:date');
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /api/content
//
// Create a new day plan OR update the whole day if it already
// exists (upsert). The frontend always sends the full day object
// so we never have to worry about partial overwrites at the day
// level.
//
// Body: { date, theme, notes, isImportant, stickers, posts }
// ═══════════════════════════════════════════════════════════════
router.post('/', async (req, res) => {
  try {
    const { date, theme, notes, isImportant, stickers, posts } = req.body;

    // Validate required field
    if (!date) {
      return res.status(400).json({ error: 'date is required.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
    }

    // upsert: create if missing, update if exists
    const plan = await ContentPlan.findOneAndUpdate(
      { date },
      {
        $set: {
          theme:       theme       ?? '',
          notes:       notes       ?? '',
          isImportant: isImportant ?? false,
          stickers:    stickers    ?? [],
          posts:       posts       ?? [],
        },
      },
      {
        new:    true,   // return the updated document
        upsert: true,   // create if it doesn't exist
        runValidators: true,
      }
    );

    return res.status(200).json({ success: true, plan });
  } catch (err) {
    // Duplicate key shouldn't happen with upsert but catch it cleanly
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A plan for this date already exists.' });
    }
    return serverError(res, err, 'POST /');
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/content/:date/important
//
// Toggle the isImportant flag without touching anything else.
// Called when the team taps the star/flag on a calendar day.
//
// Body: { isImportant: true | false }
// ═══════════════════════════════════════════════════════════════
router.patch('/:date/important', async (req, res) => {
  try {
    const { date } = req.params;
    const { isImportant } = req.body;

    if (typeof isImportant !== 'boolean') {
      return res.status(400).json({ error: 'isImportant must be a boolean.' });
    }

    const plan = await ContentPlan.findOneAndUpdate(
      { date },
      { $set: { isImportant } },
      { new: true, upsert: true }
    );

    return res.json({ success: true, plan });
  } catch (err) {
    return serverError(res, err, 'PATCH /:date/important');
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/content/:date/stickers
//
// Replace the stickers array for a day.
// Frontend sends the full updated stickers array each time.
//
// Body: { stickers: [{ pastelKey, label }] }
// ═══════════════════════════════════════════════════════════════
router.patch('/:date/stickers', async (req, res) => {
  try {
    const { date } = req.params;
    const { stickers } = req.body;

    if (!Array.isArray(stickers)) {
      return res.status(400).json({ error: 'stickers must be an array.' });
    }

    const plan = await ContentPlan.findOneAndUpdate(
      { date },
      { $set: { stickers } },
      { new: true, upsert: true }
    );

    return res.json({ success: true, plan });
  } catch (err) {
    return serverError(res, err, 'PATCH /:date/stickers');
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/content/:date/posts/:clientId/metrics
//
// Update performance metrics for a single post after it goes live.
// Only touches the metrics sub-document — caption, hashtags etc.
// are left exactly as they were.
//
// Body: { reach, impressions, likes, comments, saves, shares }
// ═══════════════════════════════════════════════════════════════
router.patch('/:date/posts/:clientId/metrics', async (req, res) => {
  try {
    const { date, clientId } = req.params;
    const { reach, impressions, likes, comments, saves, shares } = req.body;

    // Build only the fields that were actually sent
    const metricsUpdate = {};
    if (reach       !== undefined) metricsUpdate['posts.$.metrics.reach']       = Number(reach);
    if (impressions !== undefined) metricsUpdate['posts.$.metrics.impressions']  = Number(impressions);
    if (likes       !== undefined) metricsUpdate['posts.$.metrics.likes']        = Number(likes);
    if (comments    !== undefined) metricsUpdate['posts.$.metrics.comments']     = Number(comments);
    if (saves       !== undefined) metricsUpdate['posts.$.metrics.saves']        = Number(saves);
    if (shares      !== undefined) metricsUpdate['posts.$.metrics.shares']       = Number(shares);
    metricsUpdate['posts.$.metrics.recordedAt'] = new Date();
    metricsUpdate['posts.$.updatedAt']          = new Date();

    const plan = await ContentPlan.findOneAndUpdate(
      { date, 'posts.clientId': clientId },
      { $set: metricsUpdate },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ error: 'Day or post not found.' });
    }

    // Return just the updated post so the frontend doesn't have to
    // re-fetch the whole day
    const updatedPost = plan.posts.find(p => p.clientId === clientId);
    return res.json({ success: true, post: updatedPost });
  } catch (err) {
    return serverError(res, err, 'PATCH /:date/posts/:clientId/metrics');
  }
});

// ═══════════════════════════════════════════════════════════════
// PATCH /api/content/:date/posts/:clientId/status
//
// Change just the status of a single post (draft → ready → posted).
// Separate from the full day save so a quick status tap on mobile
// is a tiny request, not sending the whole day payload.
//
// Body: { status: 'draft' | 'ready' | 'posted' }
// ═══════════════════════════════════════════════════════════════
router.patch('/:date/posts/:clientId/status', async (req, res) => {
  try {
    const { date, clientId } = req.params;
    const { status } = req.body;

    const allowed = ['draft', 'ready', 'posted'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const plan = await ContentPlan.findOneAndUpdate(
      { date, 'posts.clientId': clientId },
      {
        $set: {
          'posts.$.status':    status,
          'posts.$.updatedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!plan) {
      return res.status(404).json({ error: 'Day or post not found.' });
    }

    const updatedPost = plan.posts.find(p => p.clientId === clientId);
    return res.json({ success: true, post: updatedPost });
  } catch (err) {
    return serverError(res, err, 'PATCH /:date/posts/:clientId/status');
  }
});

// ═══════════════════════════════════════════════════════════════
// GET /api/content/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns post counts by status across a date range.
// Powers the "Content Stats" sidebar widget.
// ═══════════════════════════════════════════════════════════════
router.get('/analytics/summary', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    const from = req.query.from || monthStart;
    const to   = req.query.to   || today;

    const summary = await ContentPlan.statusSummary(from, to);

    // Also pull total planned days in the range
    const totalDays = await ContentPlan.countDocuments({
      date: { $gte: from, $lte: to },
    });

    return res.json({ success: true, summary, totalDays });
  } catch (err) {
    return serverError(res, err, 'GET /analytics/summary');
  }
});

// ═══════════════════════════════════════════════════════════════
// DELETE /api/content/:date
//
// Delete an entire day's plan.
// The frontend will ask for confirmation before calling this.
// ═══════════════════════════════════════════════════════════════
router.delete('/:date', async (req, res) => {
  try {
    const { date } = req.params;

    const deleted = await ContentPlan.findOneAndDelete({ date });
    if (!deleted) {
      return res.status(404).json({ error: 'No plan found for this date.' });
    }

    return res.json({ success: true, message: `Plan for ${date} deleted.` });
  } catch (err) {
    return serverError(res, err, 'DELETE /:date');
  }
});

export default router;