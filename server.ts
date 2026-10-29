import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CACHE_DIR = path.join(process.cwd(), "data");
const CACHE_FILE = path.join(CACHE_DIR, "youtube-playlist-cache.json");

let memoryCache: { timestamp: number; playlistId: string; items: any[] } | null = null;

function loadPlaylistCache(targetPlaylistId?: string) {
  try {
    if (memoryCache && (!targetPlaylistId || memoryCache.playlistId === targetPlaylistId)) {
      return memoryCache;
    }
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, "utf-8");
      const data = JSON.parse(content);
      if (data && Array.isArray(data.items)) {
        memoryCache = data;
        return data;
      }
    }
  } catch (err) {
    console.error("Error reading playlist cache file:", err);
  }
  return null;
}

function savePlaylistCache(playlistId: string, items: any[]) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    const cacheData = {
      timestamp: Date.now(),
      playlistId,
      items,
    };
    memoryCache = cacheData;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), "utf-8");
    console.log(`Saved ${items.length} items to playlist cache.`);
  } catch (err) {
    console.error("Error saving playlist cache file:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  
  // YouTube API Proxy with caching and quota fallback
  app.get("/api/youtube-playlist", async (req, res) => {
    const playlistId = (req.query.playlistId as string) || "PLVE-5VXia_avG4pdsM0AEjXbq8D9FiebW";
    const forceRefresh = req.query.forceRefresh === "true";
    const API_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    
    const cached = loadPlaylistCache(playlistId);
    const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours server cache

    // Serve from cache if available and not forced
    if (cached && !forceRefresh && (Date.now() - cached.timestamp < CACHE_TTL)) {
      console.log(`Serving ${cached.items?.length || 0} movies from server cache`);
      res.json({ 
        items: cached.items, 
        fromCache: true, 
        cachedAt: cached.timestamp 
      });
      return;
    }

    if (!API_KEY) {
      if (cached && cached.items?.length > 0) {
        res.json({ 
          items: cached.items, 
          fromCache: true, 
          warning: "YouTube API Key missing on server, serving cached catalog" 
        });
        return;
      }
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
          },
          timeout: 10000
        });

        allItems = allItems.concat(response.data.items);
        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken);

      savePlaylistCache(playlistId, allItems);
      res.json({ items: allItems, fromCache: false });
    } catch (error: any) {
      const isQuota = error.response?.status === 403 || 
                      error.response?.data?.error?.errors?.[0]?.reason === 'quotaExceeded' ||
                      error.response?.data?.error?.message?.includes('quota');

      console.warn("YouTube API call failed (quota/error). Checking cache fallback...");

      const fallbackCache = loadPlaylistCache();
      if (fallbackCache && fallbackCache.items && fallbackCache.items.length > 0) {
        console.log(`Fallback: Serving ${fallbackCache.items.length} movies from cache file`);
        res.json({
          items: fallbackCache.items,
          fromCache: true,
          quotaExceeded: isQuota,
          warning: isQuota 
            ? "YouTube API Tageslimit (10.000 Einheiten) erreicht. Der Katalog wird nahtlos aus dem Cache geladen."
            : "YouTube API temporär nicht erreichbar. Katalog aus Cache geladen."
        });
        return;
      }

      console.error("Error in /api/youtube-playlist and no cache available:", error.response?.data || error.message);
      res.status(500).json({ 
        error: "Failed to fetch YouTube playlist", 
        quotaExceeded: isQuota,
        details: error.response?.data?.error?.message || error.message 
      });
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
