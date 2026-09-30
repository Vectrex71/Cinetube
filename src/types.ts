export interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  videoId: string;
}

export interface PlaylistResponse {
  items: YouTubeVideo[];
  nextPageToken?: string;
}
