const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');
const User = require('../models/User');

// GET /api/dictionary/:word — Free Dictionary API (no key needed)
router.get('/:word', async (req, res) => {
  try {
    const { word } = req.params;
    const response = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { timeout: 8000 }
    );

    const entry = response.data[0];
    const firstMeaning = entry.meanings?.[0];
    const firstDef = firstMeaning?.definitions?.[0];

    res.json({
      success: true,
      word: entry.word,
      phonetic: entry.phonetic || entry.phonetics?.[0]?.text || '',
      audioUrl: entry.phonetics?.find(p => p.audio)?.audio || '',
      partOfSpeech: firstMeaning?.partOfSpeech || '',
      definition: firstDef?.definition || '',
      example: firstDef?.example || '',
      synonyms: firstDef?.synonyms?.slice(0, 5) || firstMeaning?.synonyms?.slice(0, 5) || [],
      antonyms: firstDef?.antonyms?.slice(0, 3) || [],
      allMeanings: entry.meanings?.map(m => ({
        partOfSpeech: m.partOfSpeech,
        definitions: m.definitions?.slice(0, 2).map(d => ({
          definition: d.definition,
          example: d.example
        }))
      })) || []
    });
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ success: false, message: `No definition found for "${req.params.word}".` });
    }
    res.status(500).json({ success: false, message: 'Dictionary service unavailable.' });
  }
});

// POST /api/dictionary/save — Save word to personal dictionary
router.post('/save', protect, async (req, res) => {
  try {
    const { word, definition, phonetic, example, sourceBook } = req.body;
    if (!word) return res.status(400).json({ success: false, message: 'Word required.' });

    const user = await User.findById(req.user._id);
    const alreadySaved = user.savedWords.find(w => w.word.toLowerCase() === word.toLowerCase());
    if (alreadySaved) {
      return res.status(400).json({ success: false, message: `"${word}" is already in your dictionary.` });
    }

    user.savedWords.push({ word, definition, phonetic, example, sourceBook });
    user.stats.wordsLookedUp = (user.stats.wordsLookedUp || 0) + 1;
    await user.save();

    res.json({
      success: true,
      message: `"${word}" saved to your dictionary!`,
      savedWords: user.savedWords
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to save word.' });
  }
});

// GET /api/dictionary/saved/me — Get user's saved words
router.get('/saved/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('savedWords stats');
    res.json({ success: true, savedWords: user.savedWords, total: user.savedWords.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load dictionary.' });
  }
});

// DELETE /api/dictionary/saved/:wordId
router.delete('/saved/:wordId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.savedWords = user.savedWords.filter(w => w._id.toString() !== req.params.wordId);
    await user.save();
    res.json({ success: true, message: 'Word removed from dictionary.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to remove word.' });
  }
});

// POST /api/dictionary/translate — LibreTranslate (public instance)
router.post('/translate', async (req, res) => {
  try {
    const { text, targetLang = 'es', sourceLang = 'en' } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'Text required.' });

    // Use public LibreTranslate instance
    const response = await axios.post(
      'https://libretranslate.de/translate',
      { q: text.substring(0, 500), source: sourceLang, target: targetLang, format: 'text' },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    res.json({
      success: true,
      original: text,
      translated: response.data.translatedText,
      from: sourceLang,
      to: targetLang
    });
  } catch (err) {
    console.error('Translate error:', err.message);
    // Fallback: return a helpful message
    res.status(503).json({
      success: false,
      message: 'Translation service temporarily unavailable. Try again shortly.',
      fallback: true
    });
  }
});

module.exports = router;
