import { YouTubeVideo, PlaylistResponse } from '../types';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const fetchPlaylistItems = async (
  playlistId: string,
  forceRefresh: boolean = false
): Promise<PlaylistResponse> => {
  // Check localStorage cache first
  const CACHE_KEY = `youtube_playlist_v4_${playlistId}`;
  const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
  
  if (!forceRefresh) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL && Array.isArray(data) && data.length > 0) {
          console.log(`Using cached YouTube data (${data.length} movies)`);
          return { items: data, fromCache: true };
        }
      } catch (e) {
        console.warn('Failed to parse cached playlist:', e);
      }
    }
  }

  try {
    const url = `/api/youtube-playlist?playlistId=${encodeURIComponent(playlistId)}${forceRefresh ? '&forceRefresh=true' : ''}`;
    const response = await fetch(url);
    
    if (!response.ok) {
       const errBody = await response.json().catch(() => null);
       throw new Error(`Failed to fetch from proxy: ${response.status} ${response.statusText}${errBody ? ' ' + JSON.stringify(errBody) : ''}`);
    }
    
    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      console.warn('No items found in YouTube response:', data);
      return { items: [] };
    }

    const items: YouTubeVideo[] = data.items
      .map((item: any) => ({
        id: item.id,
        title: item.snippet?.title || '',
        description: item.snippet?.description || '',
        thumbnail: item.snippet?.thumbnails?.maxres?.url || item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        publishedAt: item.snippet?.publishedAt || '',
        videoId: item.contentDetails?.videoId || item.id,
      }))
      .filter((item: YouTubeVideo) => {
        if (!item.videoId || !item.title) return false;
        const title = item.title.toLowerCase();
        const isPrivate = title.includes('private video') || title.includes('privates video');
        const isDeleted = title.includes('deleted video') || title.includes('gelöschtes video');
        return !isPrivate && !isDeleted;
      });

    // Deduplicate by videoId
    const uniqueItems = Array.from(new Map(items.map(item => [item.videoId, item])).values());
    
    // Update local cache
    if (uniqueItems.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data: uniqueItems,
        timestamp: Date.now()
      }));
    }

    return {
      items: uniqueItems,
      fromCache: data.fromCache,
      quotaExceeded: data.quotaExceeded,
      warning: data.warning,
    };
  } catch (err: any) {
    console.warn('YouTube Fetch Error, checking localStorage fallback:', err);
    // Offline / fallback to last known localStorage cache
    const fallbackCached = localStorage.getItem(CACHE_KEY);
    if (fallbackCached) {
      try {
        const { data } = JSON.parse(fallbackCached);
        if (Array.isArray(data) && data.length > 0) {
          console.log(`Successfully recovered ${data.length} movies from local backup cache.`);
          return { items: data, fromCache: true, warning: 'Offline-Modus: Aus lokalem Cache geladen' };
        }
      } catch (e) {
        // ignore
      }
    }
    throw err;
  }
};
