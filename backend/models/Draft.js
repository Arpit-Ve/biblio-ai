const mongoose = require('mongoose');

const draftSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  subtitle: { type: String, maxlength: 300 },
  genre: { type: String },
  coverUrl: { type: String },
  chapters: [{
    number: Number,
    title: String,
    content: String,
    wordCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  }],
  totalWordCount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  publishedAt: Date,
  tags: [String],
  description: { type: String, maxlength: 1000 },
  reads: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

draftSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  // Calculate total word count
  this.totalWordCount = this.chapters.reduce((sum, ch) => {
    return sum + (ch.content ? ch.content.split(/\s+/).length : 0);
  }, 0);
  next();
});

module.exports = mongoose.model('Draft', draftSchema);
