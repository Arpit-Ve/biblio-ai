# 📚 Biblio AI — Full Stack Reading Platform

A complete AI-powered reading platform with backend API and connected frontend.

---

## 🗂️ Project Structure

```
biblio-ai/
├── backend/                 ← Node.js + Express API
│   ├── server.js            ← Main entry point
│   ├── models/
│   │   ├── User.js          ← User schema (auth, library, streak, badges)
│   │   └── Draft.js         ← Writer drafts schema
│   ├── routes/
│   │   ├── auth.js          ← Register, login, profile
│   │   ├── ai.js            ← Gemini AI features
│   │   ├── books.js         ← Open Library integration
│   │   ├── dictionary.js    ← Free Dictionary API + saved words
│   │   ├── social.js        ← Follow, feed, leaderboard
│   │   └── writer.js        ← Drafts, publish
│   ├── middleware/
│   │   └── auth.js          ← JWT + plan tier checks
│   ├── .env.example         ← Environment variable template
│   └── package.json
└── frontend/
    └── index.html           ← Full frontend with backend integration
```

---

## ⚡ Quick Start

### Step 1: Set up the Backend

```bash
cd backend
npm install
cp .env.example .env
```

### Step 2: Configure `.env`

Edit `backend/.env` and fill in:

```env
PORT=5000
MONGODB_URI=mongodb+srv://...     # From mongodb.com/atlas (free)
JWT_SECRET=any_long_random_string
GEMINI_API_KEY=your_key_here      # From aistudio.google.com (free)
FRONTEND_URL=http://localhost:5500
```

### Step 3: Start the Backend

```bash
cd backend
npm run dev        # With nodemon (auto-restart)
# or
npm start          # Without nodemon
```

You should see:
```
  📚 Biblio AI Backend
  🚀 Server running on http://localhost:5000
```

### Step 4: Open the Frontend

Open `frontend/index.html` in your browser directly, or use a local server:

```bash
# Option A: VS Code Live Server (recommended)
# Right-click index.html → Open with Live Server

# Option B: Python
cd frontend && python3 -m http.server 5500

# Option C: npx
cd frontend && npx serve .
```

---

## 🔑 Free API Keys

| Service | Where to Get | Cost |
|---------|-------------|------|
| **MongoDB Atlas** | cloud.mongodb.com | Free 512MB |
| **Google Gemini** | aistudio.google.com | Free 1M tokens/day |
| **Free Dictionary API** | api.dictionaryapi.dev | No key needed |
| **Open Library API** | openlibrary.org | No key needed |
| **LibreTranslate** | libretranslate.de | No key needed |

---

## 🛠️ API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/update-profile` | Update profile |

### Books (Open Library)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/books/search?q=gatsby` | Search books |
| GET | `/api/books/trending` | Trending books |
| GET | `/api/books/:id` | Book details |
| POST | `/api/books/save` | Add to library |
| PUT | `/api/books/progress` | Update reading progress |
| GET | `/api/books/library/me` | Get user's library |
| POST | `/api/books/review` | Post a review |

### AI (Google Gemini)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/summarize` | Summarize text |
| POST | `/api/ai/explain` | Explain passage |
| POST | `/api/ai/quiz` | Generate quiz |
| POST | `/api/ai/recommend` | Book recommendations |
| POST | `/api/ai/compare` | Compare two books |
| POST | `/api/ai/write-suggest` | Writing assistant |
| POST | `/api/ai/title-suggest` | Title/chapter generator |

### Dictionary
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dictionary/:word` | Look up a word |
| POST | `/api/dictionary/save` | Save to personal dict |
| GET | `/api/dictionary/saved/me` | Get saved words |
| POST | `/api/dictionary/translate` | Translate text |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/social/leaderboard` | Top readers |
| GET | `/api/social/profile/:username` | User profile |
| POST | `/api/social/follow/:userId` | Follow/unfollow |
| GET | `/api/social/feed` | Following activity feed |
| GET | `/api/social/search?q=name` | Find users |

### Writer (Author plan only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/writer/drafts` | List drafts |
| POST | `/api/writer/drafts` | Create draft |
| PUT | `/api/writer/drafts/:id` | Save draft |
| POST | `/api/writer/drafts/:id/publish` | Publish story |
| GET | `/api/writer/published` | All published stories |

---

## 🎯 Frontend Features Connected to Backend

| Feature | Backend Endpoint |
|---------|-----------------|
| Sign Up / Login | `/api/auth/register` + `/api/auth/login` |
| Click highlighted word | `/api/dictionary/:word` |
| Save word to dictionary | `/api/dictionary/save` |
| AI Summarize (pill button) | `/api/ai/summarize` |
| AI Explain (pill button) | `/api/ai/explain` |
| Quiz Me (pill button) | `/api/ai/quiz` |
| Get Book Recommendations | `/api/ai/recommend` |
| Compare Books | `/api/ai/compare` |
| Search books | `/api/books/search` |
| Add to library | `/api/books/save` |
| Writer AI Continuation | `/api/ai/write-suggest` |
| Title Suggestions | `/api/ai/title-suggest` |
| Streak display | Loaded from JWT user |

---

## 🚀 Deployment

### Backend → Railway (Free)
```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set MONGODB_URI=... GEMINI_API_KEY=... JWT_SECRET=...
```

### Frontend → Netlify (Free)
Drag and drop the `frontend/` folder at netlify.com/drop

Then update `FRONTEND_URL` in Railway environment variables.

---

## 📦 Plan Tiers

| Feature | Reader (Free) | Scholar ($9) | Author ($19) |
|---------|--------------|-------------|-------------|
| AI Summaries | 5/month | Unlimited | Unlimited |
| Dictionary | ✓ | ✓ | ✓ |
| Audiobooks | ✕ | ✓ | ✓ |
| Translation | ✕ | ✓ | ✓ |
| Writer Tools | ✕ | ✕ | ✓ |
| Publish Stories | ✕ | ✕ | ✓ |

---

Built with ❤️ using Node.js, Express, MongoDB, Google Gemini, and Open Library.
