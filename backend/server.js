require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');

const app = express();

// ─── Security ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'null' // for local file:// access
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ─── Rate Limiting ────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again in 15 minutes.' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many AI requests. Please wait a moment.' }
});

app.use(globalLimiter);
app.use('/api/ai', aiLimiter);

// ─── Body Parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Database ─────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri || uri.includes('<username>')) {
      console.log('\n⚠️  MongoDB URI not configured.');
      console.log('   Add MONGODB_URI to your .env file.');
      console.log('   Get a free cluster at: https://cloud.mongodb.com\n');
      return;
    }
    await mongoose.connect(uri);
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
  }
};
connectDB();

// ─── Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/books', require('./routes/books'));
app.use('/api/dictionary', require('./routes/dictionary'));
app.use('/api/social', require('./routes/social'));
app.use('/api/writer', require('./routes/writer'));

// ─── Health Check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'Biblio AI backend is running! 📚',
    version: '1.0.0',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      ai: '/api/ai',
      books: '/api/books',
      dictionary: '/api/dictionary',
      social: '/api/social',
      writer: '/api/writer'
    }
  });
});

// ─── Serve Frontend in Production ─────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
  });
}

// ─── Error Handler ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// ─── 404 Handler ──────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.path} not found.` });
});

// ─── Cron Jobs ────────────────────────────────────────────────
// Daily midnight: check streaks & reset if missed
cron.schedule('0 0 * * *', async () => {
  try {
    const User = require('./models/User');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Users who haven't read since before yesterday lose their streak
    const result = await User.updateMany(
      {
        'streak.current': { $gt: 0 },
        'streak.lastReadDate': { $lt: yesterday }
      },
      { $set: { 'streak.current': 0 } }
    );
    if (result.modifiedCount > 0) {
      console.log(`🔥 Streak reset for ${result.modifiedCount} users who missed a day`);
    }
  } catch (err) {
    console.error('Cron job error:', err.message);
  }
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log('\n');
  console.log('  ██████╗ ██╗██████╗ ██╗     ██╗ ██████╗     █████╗ ██╗');
  console.log('  ██╔══██╗██║██╔══██╗██║     ██║██╔═══██╗   ██╔══██╗██║');
  console.log('  ██████╔╝██║██████╔╝██║     ██║██║   ██║   ███████║██║');
  console.log('  ██╔══██╗██║██╔══██╗██║     ██║██║   ██║   ██╔══██║██║');
  console.log('  ██████╔╝██║██████╔╝███████╗██║╚██████╔╝   ██║  ██║██║');
  console.log('  ╚═════╝ ╚═╝╚═════╝ ╚══════╝╚═╝ ╚═════╝    ╚═╝  ╚═╝╚═╝');
  console.log('\n  📚 Biblio AI Backend');
  console.log(`  🚀 Server running on http://localhost:${PORT}`);
  console.log(`  🔍 Health check: http://localhost:${PORT}/api/health`);
  console.log('\n  APIs Available:');
  console.log('  ├─ POST   /api/auth/register');
  console.log('  ├─ POST   /api/auth/login');
  console.log('  ├─ GET    /api/books/search?q=...');
  console.log('  ├─ GET    /api/books/trending');
  console.log('  ├─ GET    /api/dictionary/:word');
  console.log('  ├─ POST   /api/ai/summarize');
  console.log('  ├─ POST   /api/ai/recommend');
  console.log('  ├─ POST   /api/ai/quiz');
  console.log('  ├─ POST   /api/ai/compare');
  console.log('  ├─ POST   /api/ai/write-suggest');
  console.log('  ├─ GET    /api/social/leaderboard');
  console.log('  └─ GET    /api/writer/published');
  console.log('\n');
});

module.exports = app;
