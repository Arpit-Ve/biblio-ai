const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

const OL_BASE = 'https://openlibrary.org';
const COVERS_BASE = 'https://covers.openlibrary.org/b';

function formatBook(doc) {
  const coverId = doc.cover_i || doc.cover_edition_key;
  return {
    id: doc.key?.replace('/works/', '') || doc.edition_key?.[0] || doc.key,
    title: doc.title,
    author: doc.author_name?.[0] || doc.authors?.[0]?.name || 'Unknown Author',
    authors: doc.author_name || [],
    year: doc.first_publish_year || doc.publish_year?.[0],
    coverUrl: coverId ? `${COVERS_BASE}/id/${coverId}-M.jpg` : null,
    coverLarge: coverId ? `${COVERS_BASE}/id/${coverId}-L.jpg` : null,
    subjects: doc.subject?.slice(0, 5) || [],
    pages: doc.number_of_pages_median || doc.number_of_pages,
    language: doc.language?.[0],
    isbn: doc.isbn?.[0],
    olKey: doc.key
  };
}

// GET /api/books/search?q=query&limit=10&page=1
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 12, page = 1, subject } = req.query;
    if (!q && !subject) return res.status(400).json({ success: false, message: 'Search query required.' });

    const offset = (page - 1) * limit;
    let url;
    if (subject) {
      url = `${OL_BASE}/subjects/${encodeURIComponent(subject.toLowerCase())}.json?limit=${limit}&offset=${offset}`;
      const response = await axios.get(url, { timeout: 10000 });
      const books = (response.data.works || []).map(w => ({
        id: w.key?.replace('/works/', ''),
        title: w.title,
        author: w.authors?.[0]?.name || 'Unknown',
        coverUrl: w.cover_id ? `${COVERS_BASE}/id/${w.cover_id}-M.jpg` : null,
        coverLarge: w.cover_id ? `${COVERS_BASE}/id/${w.cover_id}-L.jpg` : null,
        subjects: [],
        olKey: w.key
      }));
      return res.json({
        success: true,
        books,
        total: response.data.work_count || books.length,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    }

    url = `${OL_BASE}/search.json?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&fields=key,title,author_name,cover_i,first_publish_year,subject,number_of_pages_median,isbn,language`;
    const response = await axios.get(url, { timeout: 10000 });
    const books = (response.data.docs || []).map(formatBook);

    res.json({
      success: true,
      books,
      total: response.data.numFound || 0,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Book search error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to search books. Please try again.' });
  }
});

// GET /api/books/trending
router.get('/trending', async (req, res) => {
  try {
    const subjects = ['fiction', 'mystery', 'science_fiction', 'romance', 'history'];
    const promises = subjects.slice(0, 3).map(s =>
      axios.get(`${OL_BASE}/subjects/${s}.json?limit=4&offset=${Math.floor(Math.random() * 20)}`, { timeout: 8000 })
    );
    const results = await Promise.allSettled(promises);
    const books = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => (r.value.data.works || []).slice(0, 3).map(w => ({
        id: w.key?.replace('/works/', ''),
        title: w.title,
        author: w.authors?.[0]?.name || 'Unknown',
        coverUrl: w.cover_id ? `${COVERS_BASE}/id/${w.cover_id}-M.jpg` : null,
        subject: w.subject?.[0],
        olKey: w.key
      })));

    res.json({ success: true, books: books.slice(0, 12) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load trending books.' });
  }
});

// GET /api/books/:id — Get book details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const response = await axios.get(`${OL_BASE}/works/${id}.json`, { timeout: 10000 });
    const data = response.data;

    // Get author details
    let authorName = 'Unknown Author';
    if (data.authors?.[0]?.author?.key) {
      try {
        const authorRes = await axios.get(`${OL_BASE}${data.authors[0].author.key}.json`, { timeout: 5000 });
        authorName = authorRes.data.name || authorName;
      } catch (e) {}
    }

    // Get editions for cover
    let coverUrl = null;
    if (data.covers?.[0]) {
      coverUrl = `${COVERS_BASE}/id/${data.covers[0]}-L.jpg`;
    }

    const description = typeof data.description === 'string'
      ? data.description
      : data.description?.value || 'No description available.';

    res.json({
      success: true,
      book: {
        id,
        title: data.title,
        author: authorName,
        description: description.substring(0, 1000),
        coverUrl,
        subjects: data.subjects?.slice(0, 8) || [],
        firstPublished: data.first_publish_date,
        olKey: data.key
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Book not found.' });
  }
});

// POST /api/books/save — Save book to library
router.post('/save', protect, async (req, res) => {
  try {
    const { bookId, title, author, coverUrl } = req.body;
    if (!bookId || !title) return res.status(400).json({ success: false, message: 'Book ID and title required.' });

    const user = await User.findById(req.user._id);
    const exists = user.library.find(b => b.bookId === bookId);
    if (exists) {
      return res.status(400).json({ success: false, message: 'This book is already in your library.' });
    }

    user.library.push({ bookId, title, author, coverUrl, progress: 0 });
    await user.save();

    res.json({ success: true, message: `"${title}" added to your library!`, library: user.library });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save book.' });
  }
});

// PUT /api/books/progress — Update reading progress
router.put('/progress', protect, async (req, res) => {
  try {
    const { bookId, progress, currentChapter } = req.body;
    const user = await User.findById(req.user._id);
    const book = user.library.find(b => b.bookId === bookId);
    if (!book) return res.status(404).json({ success: false, message: 'Book not in library.' });

    book.progress = Math.min(100, Math.max(0, progress));
    book.lastReadAt = new Date();
    if (currentChapter) book.currentChapter = currentChapter;

    // Mark finished
    if (progress >= 100 && !book.finished) {
      book.finished = true;
      book.finishedAt = new Date();
      user.stats.booksRead = (user.stats.booksRead || 0) + 1;

      // Check for author badge (5+ books by same author)
      const finishedByAuthor = user.library.filter(b => b.author === book.author && b.finished).length;
      if (finishedByAuthor >= 5) {
        const alreadyHasBadge = user.badges.some(b => b.type === 'author' && b.name.includes(book.author));
        if (!alreadyHasBadge) {
          user.badges.push({
            type: 'author',
            name: `${book.author} Expert`,
            description: `Read 5+ books by ${book.author}`
          });
        }
      }
    }

    // Update reading streak
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastRead = user.streak.lastReadDate ? new Date(user.streak.lastReadDate) : null;
    if (lastRead) lastRead.setHours(0, 0, 0, 0);

    const isToday = lastRead && lastRead.getTime() === today.getTime();
    const isYesterday = lastRead && (today - lastRead) === 86400000;

    if (!isToday) {
      if (isYesterday) {
        user.streak.current += 1;
      } else if (!lastRead) {
        user.streak.current = 1;
      } else {
        user.streak.current = 1; // reset
      }
      user.streak.longest = Math.max(user.streak.current, user.streak.longest || 0);
      user.streak.lastReadDate = today;
      if (!user.streak.readDates) user.streak.readDates = [];
      user.streak.readDates.push(today);
      if (user.streak.readDates.length > 90) user.streak.readDates.shift();
    }

    await user.save();
    res.json({ success: true, message: 'Progress saved!', book, streak: user.streak });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ success: false, message: 'Failed to update progress.' });
  }
});

// GET /api/books/library/me — Get user's library
router.get('/library/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('library streak stats badges');
    res.json({ success: true, library: user.library, streak: user.streak, stats: user.stats, badges: user.badges });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load library.' });
  }
});

// POST /api/books/review — Post a review
router.post('/review', protect, async (req, res) => {
  try {
    const { bookId, title, rating, review } = req.body;
    if (!bookId || !rating) return res.status(400).json({ success: false, message: 'Book ID and rating required.' });

    const user = await User.findById(req.user._id);
    const existing = user.reviews.findIndex(r => r.bookId === bookId);
    if (existing > -1) {
      user.reviews[existing] = { bookId, title, rating, review, createdAt: new Date() };
    } else {
      user.reviews.push({ bookId, title, rating, review });
    }
    await user.save();

    res.json({ success: true, message: 'Review saved!', reviews: user.reviews });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save review.' });
  }
});

module.exports = router;
