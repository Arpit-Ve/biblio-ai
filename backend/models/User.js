const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const savedWordSchema = new mongoose.Schema({
  word: String,
  definition: String,
  phonetic: String,
  example: String,
  sourceBook: String,
  savedAt: { type: Date, default: Date.now }
});

const readingProgressSchema = new mongoose.Schema({
  bookId: String,
  title: String,
  author: String,
  coverUrl: String,
  progress: { type: Number, default: 0, min: 0, max: 100 },
  currentChapter: { type: Number, default: 1 },
  startedAt: { type: Date, default: Date.now },
  lastReadAt: { type: Date, default: Date.now },
  finished: { type: Boolean, default: false },
  finishedAt: Date
});

const reviewSchema = new mongoose.Schema({
  bookId: String,
  title: String,
  rating: { type: Number, min: 1, max: 5 },
  review: String,
  createdAt: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  displayName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  bio: { type: String, maxlength: 300 },
  avatar: { type: String, default: '' },

  // Plan
  plan: {
    type: String,
    enum: ['reader', 'scholar', 'author'],
    default: 'reader'
  },

  // AI usage tracking (for free tier limits)
  aiUsage: {
    summaries: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  },

  // Reading Stats
  library: [readingProgressSchema],
  savedWords: [savedWordSchema],
  reviews: [reviewSchema],

  // Streak tracking
  streak: {
    current: { type: Number, default: 0 },
    longest: { type: Number, default: 0 },
    lastReadDate: { type: Date },
    readDates: [{ type: Date }]
  },

  // Social
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Badges
  badges: [{
    type: { type: String },
    name: String,
    description: String,
    earnedAt: { type: Date, default: Date.now }
  }],

  // Stats
  stats: {
    booksRead: { type: Number, default: 0 },
    pagesRead: { type: Number, default: 0 },
    wordsLookedUp: { type: Number, default: 0 },
    quizScore: { type: Number, default: 0 },
    quizTaken: { type: Number, default: 0 }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Reset monthly AI usage
userSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  const lastReset = new Date(this.aiUsage.lastReset);
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.aiUsage.summaries = 0;
    this.aiUsage.lastReset = now;
  }
};

module.exports = mongoose.model('User', userSchema);
