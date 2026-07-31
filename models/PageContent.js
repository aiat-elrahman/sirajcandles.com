import mongoose from 'mongoose';

const pageContentSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: '' },
    body: { type: String, default: '' },
    isPublished: { type: Boolean, default: true },
    updatedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('PageContent', pageContentSchema);
