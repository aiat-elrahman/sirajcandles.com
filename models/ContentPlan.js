import mongoose from 'mongoose';

// ─────────────────────────────────────────────
// SUB-SCHEMA: Metrics (filled in manually after
// a post goes live — Instagram API can hook in
// here later with zero model changes)
// ─────────────────────────────────────────────
const MetricsSchema = new mongoose.Schema({
  reach:       { type: Number, default: 0 },
  impressions: { type: Number, default: 0 },
  likes:       { type: Number, default: 0 },
  comments:    { type: Number, default: 0 },
  saves:       { type: Number, default: 0 },
  shares:      { type: Number, default: 0 },
  // When the team recorded these numbers
  recordedAt:  { type: Date, default: null },
}, { _id: false });

// ─────────────────────────────────────────────
// SUB-SCHEMA: Individual Post / Piece of Content
// ─────────────────────────────────────────────
const PostSchema = new mongoose.Schema({
  // Unique client-side id so React can key on it
  // without waiting for a DB round-trip
  clientId: { type: String, required: true },

  time:    { type: String, default: '18:00' },

  // vo | music | carousel | photo | story | bazaar
  type: {
    type: String,
    enum: ['vo', 'music', 'carousel', 'photo', 'story', 'bazaar'],
    default: 'photo',
  },

  product:    { type: String, default: '' }, // product name or topic
  goal:       { type: String, default: '' }, // content goal / angle
  script:     { type: String, default: '' }, // voiceover / screen text
  caption:    { type: String, default: '' }, // instagram / tiktok caption
  hashtags:   [{ type: String }],            // array of '#tag' strings

  // Reference images: stored as Cloudinary URLs
  // (uploaded via the existing /api/upload endpoint)
  photoUrls:  [{ type: String }],

  // draft → ready → posted
  status: {
    type: String,
    enum: ['draft', 'ready', 'posted'],
    default: 'draft',
  },

  // Filled in by the team once the post is live
  metrics: { type: MetricsSchema, default: () => ({}) },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────
// SUB-SCHEMA: Sticker / Label attached to a calendar day
//
// pastelKey maps to one of the PASTEL_STICKERS defined on the
// frontend (emoji + color pair). Storing the key keeps the DB
// lean; the frontend owns the visual definition so you can add
// new stickers without a migration.
//
// Examples of pastelKey values the frontend will send:
//   'birthday' | 'launch' | 'sale' | 'reminder' |
//   'idea'     | 'event'  | 'shoot' | 'deadline' | 'collab' | 'rest'
// ─────────────────────────────────────────────────────────────────────
const StickerSchema = new mongoose.Schema({
  pastelKey: { type: String, required: true },  // maps to frontend sticker definition
  label:     { type: String, default: '' },     // optional custom label the team adds
}, { _id: false });

// ─────────────────────────────────────────────
// MAIN SCHEMA: One document = one calendar day
// ─────────────────────────────────────────────
const ContentPlanSchema = new mongoose.Schema(
  {
    // Stored as 'YYYY-MM-DD' string — easy to query, easy to display,
    // no timezone headaches when you just want "the plan for May 20"
    date: {
      type: String,
      required: true,
      unique: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },

    theme:   { type: String, default: '' },  // headline theme for the day
    notes:   { type: String, default: '' },  // team notes / reminders / props needed

    // If true the day is highlighted differently on the calendar
    isImportant: { type: Boolean, default: false },

    // Array of sticker objects the team pins to this day
    stickers: { type: [StickerSchema], default: [] },

    // All the content pieces planned for this day
    posts: { type: [PostSchema], default: [] },
  },
  {
    timestamps: true, // adds createdAt + updatedAt at document level
  }
);

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────

// Lets you quickly fetch a date range, e.g. "next two weeks"
ContentPlanSchema.index({ date: 1 });

// Lets you quickly find all days that have a "posted" piece of content
// (useful later for analytics roll-ups)
ContentPlanSchema.index({ 'posts.status': 1 });

// ─────────────────────────────────────────────
// HELPERS (static methods on the model)
// ─────────────────────────────────────────────

// Fetch a range of days in one query, sorted oldest → newest
// Usage: ContentPlan.getRange('2025-05-01', '2025-05-31')
ContentPlanSchema.statics.getRange = function (fromDate, toDate) {
  return this.find({
    date: { $gte: fromDate, $lte: toDate },
  }).sort({ date: 1 });
};

// Quick summary: how many posts are in each status across a range
// Returns: [ { status: 'posted', count: 12 }, ... ]
ContentPlanSchema.statics.statusSummary = function (fromDate, toDate) {
  return this.aggregate([
    { $match: { date: { $gte: fromDate, $lte: toDate } } },
    { $unwind: '$posts' },
    { $group: { _id: '$posts.status', count: { $sum: 1 } } },
    { $project: { _id: 0, status: '$_id', count: 1 } },
  ]);
};

// ─────────────────────────────────────────────
// MIDDLEWARE: keep post.updatedAt fresh on save
// ─────────────────────────────────────────────
ContentPlanSchema.pre('save', function (next) {
  this.posts = this.posts.map(p => ({
    ...p,
    updatedAt: new Date(),
  }));
  next();
});

export default mongoose.model('ContentPlan', ContentPlanSchema);