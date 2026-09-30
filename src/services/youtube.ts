import { YouTubeVideo, PlaylistResponse } from '../types';

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

export const fetchPlaylistItems = async (
  playlistId: string,
  forceRefresh: boolean = false
): Promise<PlaylistResponse> => {
  const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
  
  if (!API_KEY) {
      throw new Error("YouTube API Key missing");
  }

  // Check cache first
  const CACHE_KEY = `youtube_playlist_v4_${playlistId}`;
  const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  
  if (!forceRefresh) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        console.log('Using cached YouTube data');
        return { items: data };
      }
    }
  }

  try {
    const response = await fetch(`/api/youtube-playlist?playlistId=${playlistId}`);
    
    if (!response.ok) {
       const errBody = await response.json().catch(() => null);
       throw new Error(`Failed to fetch from proxy: ${response.status} ${response.statusText}${errBody ? ' ' + JSON.stringify(errBody) : ''}`);
    }
    
    const data = await response.json();

    if (!data.items) {
      console.warn('No items found in YouTube response:', data);
      return { items: [] };
    }

    const items: YouTubeVideo[] = data.items
      .map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        videoId: item.contentDetails.videoId,
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
    
    // Update cache
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data: uniqueItems,
      timestamp: Date.now()
    }));

    return {
      items: uniqueItems,
    };
  } catch (err: any) {
    console.error('YouTube Fetch Error:', err);
    throw err;
  }
};
