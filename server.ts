import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  
  // YouTube API Proxy
  app.get("/api/youtube-playlist", async (req, res) => {
    const { playlistId } = req.query;
    // The YouTube API Key.
    const API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    
    if (!API_KEY) {
        res.status(500).json({ error: "YouTube API Key missing" });
        return;
    }

    let allItems: any[] = [];
    let nextPageToken: string | undefined;

    try {
        do {
            const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
                params: {
                    part: 'snippet,contentDetails',
                    maxResults: 50,
                    playlistId,
                    key: API_KEY,
                    pageToken: nextPageToken,
                },
                headers: {
                    'Referer': req.headers.referer || req.headers.origin || `https://${req.get('host')}/`,
                    'Origin': req.headers.origin || `https://${req.get('host')}`
                }
            });

            allItems = allItems.concat(response.data.items);
            nextPageToken = response.data.nextPageToken;
        } while (nextPageToken);

        res.json({ items: allItems });
    } catch (error) {
        console.error("Error in /api/youtube-playlist:", error);
        res.status(500).json({ error: "Failed to fetch YouTube playlist" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
