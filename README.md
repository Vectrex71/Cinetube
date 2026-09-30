# 🎬 CineTube

> **CineTube** is a sleek, Netflix-inspired web application designed to curate, organize, and stream feature-length movies from YouTube playlists. Powered by **Google Gemini AI** for automatic metadata enrichment, it features personal watchlists, full admin controls, real-time Firebase syncing, and tablet-optimized display management.

---

## ✨ Key Features

### 🍿 Netflix-Style Streaming Experience
- **Dynamic Hero Banner:** Automatically rotating featured movies with background backdrop, quick info, and instant playback.
- **Categorized Carousels:** Responsive horizontal sliders for *New Releases*, *Curated For You*, *Popular on CineTube*, *Best Recommendations*, and *All Movies*.
- **Instant Search:** Full-text real-time search across titles, synopses, cast members, directors, and genres.
- **Interactive Genre Pills:** Filter the entire library by genre (e.g. Action, Drama, Comedy, Sci-Fi, Thriller, Romance).
- **Fullscreen Mode:** One-click immersive fullscreen viewing on desktop and mobile.

### 🤖 AI-Powered Metadata Enrichment (Google Gemini)
- Automatically extracts the actual movie title from complex, clickbait, or promotional YouTube video titles.
- Fetches comprehensive details including: synopsis (overview), release year, runtime, age rating / score, director, cast, and genres.
- Persists and caches all metadata in **Google Cloud Firestore** to avoid duplicate API requests.

### 🛠️ Dedicated Admin Suite
- **One-Click Admin Toggle:** Seamlessly switch between user mode and administrative tools.
- **Recommendation Curation:** Add or remove movies from the global *CineTube Recommendations* carousel with a single click (Trophy icon).
- **Trash & Video Hiding:** Hide outdated or unwanted videos from the public catalog, restore them, or delete them permanently.
- **Custom Search Title Override:** For tricky YouTube video titles (e.g., *"You MUST watch this thrill-ride to the end..."*), admins can directly set a custom search keyword so the AI identifies the exact movie immediately.
- **Category & Genre Editor:** Add, modify, or remove genre tags on any movie directly within the movie details dialog.
- **Database Differential Tool (DB-Check):** Analyzes the playlist against Firestore to detect uncached movies and triggers batch synchronization.

### 📋 Personal Watchlist ("My List")
- Users can save their favorite titles to a private watchlist with one click (`+` / `Bookmark` icon).
- Real-time synchronization across devices backed by Firebase Firestore.

### 📱 Tablet & Mobile Optimizations
- **Screen Wake Lock API:** Prevents tablets (iPad, Android tablets) from dimming or falling asleep after 2 minutes of inactivity while browsing or watching movies.
- **Smart Stacking & Z-Index Isolation:** Independent stacking contexts ensure hover scaling never overlaps adjacent rows or cuts off action buttons.
- **Inline Tablet Playback (`playsinline`):** Clean player modal integration specifically tuned for touch devices.

---

## 🚀 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool & Bundler** | [Vite](https://vite.dev/) |
| **Styling & Icons** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Motion](https://motion.dev/) |
| **Server / Proxy** | [Express](https://expressjs.com/) on Node.js (`tsx`) |
| **Database & Auth** | [Firebase Authentication](https://firebase.google.com/) & [Cloud Firestore](https://firebase.google.com/docs/firestore) |
| **Artificial Intelligence** | [Google Gemini API](https://ai.google.dev/) (`@google/genai`) |
| **Video Playback** | [react-youtube](https://github.com/tjallingt/react-youtube) (YouTube IFrame API) |

---

## 📦 Installation & Local Setup

### Prerequisites
- **Node.js** (v20 or higher recommended)
- **npm** or **bun**
- A **Google Cloud Project** with the **YouTube Data API v3** enabled
- A **Google AI Studio** API Key for Gemini
- A **Firebase Project** with Firestore and Authentication (Google Sign-In) enabled

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/cinetube.git
cd cinetube
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Open `.env` and provide your credentials:

```env
# Application Host URL
APP_URL="http://localhost:3000"

# YouTube Data API v3 Key (https://console.cloud.google.com/apis/library/youtube.googleapis.com)
VITE_YOUTUBE_API_KEY="YOUR_YOUTUBE_API_KEY"

# Google Gemini API Key (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
```

### 4. Configure Firebase
Copy the example Firebase configuration file:

```bash
cp firebase-applet-config.example.json firebase-applet-config.json
```

Edit `firebase-applet-config.json` with your Firebase project settings:

```json
{
  "projectId": "your-firebase-project-id",
  "appId": "1:000000000000:web:000000000000",
  "apiKey": "YOUR_FIREBASE_WEB_API_KEY",
  "authDomain": "your-firebase-project-id.firebaseapp.com",
  "firestoreDatabaseId": "(default)",
  "storageBucket": "your-firebase-project-id.firebasestorage.app",
  "messagingSenderId": "000000000000"
}
```

*(Alternatively, you can provide these settings as `VITE_FIREBASE_*` environment variables in your `.env` file.)*

### 5. Configure Playlist & Admin Email (Optional)
In `src/App.tsx`, customize your default YouTube playlist and admin email:

```typescript
const PLAYLIST_ID = 'YOUR_YOUTUBE_PLAYLIST_ID';
const ADMIN_EMAIL = 'your-email@gmail.com';
```

---

## 🛠️ Available Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts the Express server and Vite development environment on `http://localhost:3000` |
| `npm run build` | Compiles and builds the production bundle into `/dist` |
| `npm run start` | Runs the production Express server (`node server.ts`) |
| `npm run lint` | Runs TypeScript static type checking (`tsc --noEmit`) |
| `npm run clean` | Removes the `/dist` build output directory |

---

## 🔒 Security & GitHub Secret Scanning

### Note on Firebase Web API Keys
If GitHub displays an alert regarding a Google API key in `firebase-applet-config.json`:
- **Firebase Web API keys are client-side identifiers**, not private master secrets. According to Google's official documentation, Firebase Web API keys are intended to be public in browser bundles; actual security is enforced through **Firebase Authentication** and **Firestore Security Rules** (`firestore.rules`).
- To prevent automated scanner alerts on GitHub, `firebase-applet-config.json` is included in `.gitignore`. Use `firebase-applet-config.example.json` or `.env` variables for public repositories.
- In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), you can also restrict your API key to your specific domain (HTTP Referrers) for added protection.

---

## 📁 Project Structure

```
├── src/
│   ├── components/
│   │   ├── DifferenceView.tsx   # DB cache difference analyzer & bulk sync
│   │   ├── Hero.tsx             # Rotating featured movie banner
│   │   ├── LoginWall.tsx        # Authentication landing screen
│   │   ├── MovieInfoModal.tsx   # Rich details, Gemini synopsis & category editor
│   │   ├── MovieRow.tsx         # Netflix-style horizontal carousel
│   │   ├── PlayerModal.tsx      # Embedded YouTube video player modal
│   │   └── Thumbnail.tsx        # Fallback-resilient YouTube thumbnail loader
│   ├── services/
│   │   ├── gemini.ts            # Google Gemini AI client
│   │   ├── movieInfo.ts         # Metadata extraction & Firestore caching
│   │   ├── wakeLock.ts          # Screen Wake Lock manager (tablet anti-dimming)
│   │   └── youtube.ts           # YouTube Data API integration
│   ├── firebase.ts              # Firebase app, auth & Firestore initialization
│   ├── types.ts                 # TypeScript interfaces and data models
│   ├── App.tsx                  # Main application shell, views & routing
│   └── main.tsx                 # React DOM entry point
├── server.ts                    # Express API server & static middleware
├── firestore.rules              # Firestore database security rules
├── package.json
└── vite.config.ts
```

---

## 📄 License

This project is created for personal and educational use for showcasing curated YouTube media. All streaming content belongs to their respective copyright holders under YouTube's Terms of Service.
