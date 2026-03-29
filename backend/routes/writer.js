const express = require('express');
const router = express.Router();
const { protect, requirePlan } = require('../middleware/auth');
const Draft = require('../models/Draft');

// GET /api/writer/drafts — List user's drafts
router.get('/drafts', protect, requirePlan('author'), async (req, res) => {
  try {
    const drafts = await Draft.find({ author: req.user._id })
      .select('-chapters.content')
      .sort({ updatedAt: -1 });
    res.json({ success: true, drafts });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load drafts.' });
  }
});

// POST /api/writer/drafts — Create new draft
router.post('/drafts', protect, requirePlan('author'), async (req, res) => {
  try {
    const { title, genre, description } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title required.' });

    const draft = await Draft.create({
      author: req.user._id,
      title,
      genre,
      description,
      chapters: [{ number: 1, title: 'Chapter 1', content: '' }]
    });

    res.status(201).json({ success: true, message: 'Draft created!', draft });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create draft.' });
  }
});

// GET /api/writer/drafts/:id — Get single draft
router.get('/drafts/:id', protect, requirePlan('author'), async (req, res) => {
  try {
    const draft = await Draft.findOne({ _id: req.params.id, author: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found.' });
    res.json({ success: true, draft });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load draft.' });
  }
});

// PUT /api/writer/drafts/:id — Update draft
router.put('/drafts/:id', protect, requirePlan('author'), async (req, res) => {
  try {
    const { title, subtitle, genre, description, chapters, coverUrl, tags } = req.body;
    const draft = await Draft.findOne({ _id: req.params.id, author: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found.' });

    if (title) draft.title = title;
    if (subtitle !== undefined) draft.subtitle = subtitle;
    if (genre) draft.genre = genre;
    if (description) draft.description = description;
    if (coverUrl) draft.coverUrl = coverUrl;
    if (tags) draft.tags = tags;
    if (chapters) {
      // Update chapters with word counts
      draft.chapters = chapters.map(ch => ({
        ...ch,
        wordCount: ch.content ? ch.content.split(/\s+/).filter(Boolean).length : 0,
        updatedAt: new Date()
      }));
    }

    await draft.save();
    res.json({ success: true, message: 'Draft saved!', draft });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save draft.' });
  }
});

// POST /api/writer/drafts/:id/publish — Publish to library
router.post('/drafts/:id/publish', protect, requirePlan('author'), async (req, res) => {
  try {
    const draft = await Draft.findOne({ _id: req.params.id, author: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found.' });

    if (draft.chapters.length === 0 || draft.totalWordCount < 100) {
      return res.status(400).json({ success: false, message: 'Your story needs at least 100 words to publish.' });
    }

    draft.status = 'published';
    draft.publishedAt = new Date();
    await draft.save();

    res.json({
      success: true,
      message: `"${draft.title}" is now published! Readers can discover it in the Biblio AI library.`,
      draft
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to publish.' });
  }
});

// GET /api/writer/published — All published stories (public)
router.get('/published', async (req, res) => {
  try {
    const { genre, limit = 12, page = 1 } = req.query;
    const query = { status: 'published' };
    if (genre) query.genre = genre;

    const drafts = await Draft.find(query)
      .populate('author', 'username displayName avatar')
      .select('-chapters.content')
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Draft.countDocuments(query);

    res.json({ success: true, stories: drafts, total, page: parseInt(page) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load stories.' });
  }
});

// DELETE /api/writer/drafts/:id
router.delete('/drafts/:id', protect, requirePlan('author'), async (req, res) => {
  try {
    const draft = await Draft.findOneAndDelete({ _id: req.params.id, author: req.user._id });
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found.' });
    res.json({ success: true, message: 'Draft deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete draft.' });
  }
});

module.exports = router;
