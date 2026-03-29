const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect, checkAILimit } = require('../middleware/auth');
const User = require('../models/User');

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please add GEMINI_API_KEY to your .env file.');
  }

  const response = await axios.post(
    `${GEMINI_URL}?key=${apiKey}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      }
    },
    { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No response from AI. Please try again.');
  return text.trim();
}

// POST /api/ai/summarize
router.post('/summarize', protect, checkAILimit, async (req, res) => {
  try {
    const { text, bookTitle, chapter, type = 'chapter' } = req.body;
    if (!text || text.trim().length < 50) {
      return res.status(400).json({ success: false, message: 'Please provide text to summarize (minimum 50 characters).' });
    }

    const prompt = `You are a literary assistant for Biblio AI, a premium reading platform.
${bookTitle ? `Book: "${bookTitle}"` : ''}
${chapter ? `Chapter: ${chapter}` : ''}

Summarize the following passage in an engaging, insightful way. Keep it to 3-5 sentences. 
Highlight the key events, character moments, and themes. Use clear, accessible language.

Text to summarize:
${text.substring(0, 3000)}

Provide ONLY the summary, no introductory phrases like "This passage..."`;

    const summary = await callGemini(prompt);

    // Track usage
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'aiUsage.summaries': 1 }
    });

    res.json({ success: true, summary, type });
  } catch (err) {
    console.error('Summarize error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/explain
router.post('/explain', protect, async (req, res) => {
  try {
    const { text, bookTitle, context } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text required.' });

    const prompt = `You are a literary tutor on Biblio AI. A reader has selected a passage they find confusing.
${bookTitle ? `From: "${bookTitle}"` : ''}

Explain the following passage clearly and engagingly in 2-4 sentences. Include any relevant historical, cultural, or literary context that helps understanding.

Passage: "${text.substring(0, 1500)}"

${context ? `Additional context from the reader: ${context}` : ''}

Provide a clear, helpful explanation only. No preamble.`;

    const explanation = await callGemini(prompt);
    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/quiz
router.post('/quiz', protect, async (req, res) => {
  try {
    const { text, bookTitle, difficulty = 'medium' } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text required to generate quiz.' });

    const prompt = `You are a reading comprehension tutor on Biblio AI.
${bookTitle ? `Book: "${bookTitle}"` : ''}

Generate 3 multiple-choice quiz questions based on this text. Difficulty: ${difficulty}.

Text: ${text.substring(0, 2000)}

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correct": 0,
      "explanation": "Brief explanation of why this answer is correct."
    }
  ]
}`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const quiz = JSON.parse(clean);

    res.json({ success: true, quiz });
  } catch (err) {
    console.error('Quiz error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate quiz. Please try again.' });
  }
});

// POST /api/ai/recommend
router.post('/recommend', protect, async (req, res) => {
  try {
    const { prompt: userPrompt, genres, recentBooks } = req.body;
    if (!userPrompt) return res.status(400).json({ success: false, message: 'Tell me what you\'re looking for.' });

    const prompt = `You are a world-class book recommendation engine on Biblio AI.

Reader's request: "${userPrompt}"
${genres?.length ? `Preferred genres: ${genres.join(', ')}` : ''}
${recentBooks?.length ? `Recently read: ${recentBooks.join(', ')}` : ''}

Recommend exactly 4 books. Return ONLY valid JSON:
{
  "recommendations": [
    {
      "title": "Book Title",
      "author": "Author Name",
      "year": 1999,
      "genre": "Genre",
      "reason": "1-2 sentence personalized reason why this reader will love it",
      "difficulty": "easy|medium|challenging",
      "pages": 320
    }
  ]
}`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    res.json({ success: true, ...data });
  } catch (err) {
    console.error('Recommend error:', err);
    res.status(500).json({ success: false, message: 'Failed to get recommendations. Please try again.' });
  }
});

// POST /api/ai/compare
router.post('/compare', protect, async (req, res) => {
  try {
    const { book1, book2 } = req.body;
    if (!book1 || !book2) return res.status(400).json({ success: false, message: 'Two book titles required.' });

    const prompt = `You are a literary analyst on Biblio AI. Compare these two books for a reader trying to decide what to read next.

Book 1: "${book1}"
Book 2: "${book2}"

Return ONLY valid JSON:
{
  "book1": {
    "title": "${book1}",
    "themes": ["theme1", "theme2", "theme3"],
    "tone": "descriptive tone",
    "difficulty": "easy|medium|challenging",
    "bestFor": "Type of reader who would enjoy this",
    "pages": 300,
    "verdict": "One sentence recommendation"
  },
  "book2": {
    "title": "${book2}",
    "themes": ["theme1", "theme2", "theme3"],
    "tone": "descriptive tone",
    "difficulty": "easy|medium|challenging",
    "bestFor": "Type of reader who would enjoy this",
    "pages": 250,
    "verdict": "One sentence recommendation"
  },
  "summary": "2-3 sentence comparison helping the reader choose",
  "winner": "${book1} or ${book2}",
  "winnerReason": "Brief reason"
}`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const comparison = JSON.parse(clean);

    res.json({ success: true, comparison });
  } catch (err) {
    console.error('Compare error:', err);
    res.status(500).json({ success: false, message: 'Failed to compare books. Please try again.' });
  }
});

// POST /api/ai/write-suggest
router.post('/write-suggest', protect, async (req, res) => {
  try {
    const { text, style, genre } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text required.' });

    const prompt = `You are an AI writing assistant on Biblio AI. A writer has paused mid-sentence and needs a continuation suggestion.
${genre ? `Genre: ${genre}` : ''}
${style ? `Writing style: ${style}` : ''}

Continue this passage naturally. Write 1-2 sentences that flow seamlessly from where they stopped. Match their voice, tone, and style exactly.

Text so far: "${text.substring(0, 1500)}"

Return ONLY the continuation text (not the original), no quotes, no explanation.`;

    const suggestion = await callGemini(prompt);
    res.json({ success: true, suggestion });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/ai/title-suggest
router.post('/title-suggest', protect, async (req, res) => {
  try {
    const { description, genre, tone } = req.body;
    if (!description) return res.status(400).json({ success: false, message: 'Story description required.' });

    const prompt = `You are a creative writing assistant on Biblio AI. Generate compelling book titles.

Story description: "${description}"
${genre ? `Genre: ${genre}` : ''}
${tone ? `Tone: ${tone}` : ''}

Return ONLY valid JSON:
{
  "titles": [
    { "title": "Title 1", "why": "Brief reason this title works" },
    { "title": "Title 2", "why": "Brief reason this title works" },
    { "title": "Title 3", "why": "Brief reason this title works" },
    { "title": "Title 4", "why": "Brief reason this title works" },
    { "title": "Title 5", "why": "Brief reason this title works" }
  ],
  "chapterNames": ["Chapter 1 Name", "Chapter 2 Name", "Chapter 3 Name", "Chapter 4 Name", "Chapter 5 Name"]
}`;

    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);

    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate titles. Please try again.' });
  }
});

module.exports = router;
