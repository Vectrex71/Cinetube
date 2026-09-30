import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface ThumbnailProps {
  videoSrc: string;
  className?: string;
  alt?: string;
  loading?: string;
  quality?: 'high' | 'medium';
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  [key: string]: any;
}

export function Thumbnail({ videoSrc, className, alt, quality = 'medium', ...props }: ThumbnailProps) {
  // Extract video ID from URL like "https://i.ytimg.com/vi/ID/maxresdefault.jpg"
  const match = videoSrc.match(/\/vi\/([^\/]+)\//);
  const videoId = match ? match[1] : null;

  const [attempt, setAttempt] = useState(0);
  const [src, setSrc] = useState(videoSrc);

  useEffect(() => {
    setAttempt(0);
    setSrc(videoSrc);
  }, [videoSrc]);

  const fallbacks = videoId ? (
    quality === 'medium' 
      ? [
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/0.jpg`,
        ]
      : [
          `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
          `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`,
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/0.jpg`,
        ]
  ) : [videoSrc];

  const handleNext = () => {
    if (attempt < fallbacks.length - 1) {
      setAttempt(prev => prev + 1);
      setSrc(fallbacks[attempt + 1]);
    }
  };

  return (
    <img
      src={videoId ? fallbacks[attempt] : src}
      className={cn("h-full w-full object-cover", className)}
      referrerPolicy="no-referrer"
      alt={alt || "Thumbnail"}
      onError={handleNext}
      onLoad={(e) => {
        const img = e.currentTarget;
        // YouTube sometimes returns a 120x90 placeholder image when the requested thumbnail doesn't exist.
        if (img.naturalWidth === 120 && img.naturalHeight === 90) {
          handleNext();
        }
      }}
      {...props}
    />
  );
}
