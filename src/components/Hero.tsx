import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { YouTubeVideo } from '../types';
import { Play, Info, ChevronLeft, ChevronRight, Star, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cleanTitle } from '../lib/utils';
import { Thumbnail } from './Thumbnail';

interface HeroProps {
  videos?: YouTubeVideo[];
  video?: YouTubeVideo;
  allMovieDetails?: Map<string, any>;
  onPlay: (video: YouTubeVideo) => void;
  onInfo: (video: YouTubeVideo) => void;
}

export const Hero: React.FC<HeroProps> = ({
  videos = [],
  video,
  allMovieDetails,
  onPlay,
  onInfo
}) => {
  // Normalize video list: ensure at least one video, deduplicated by videoId
  const playlist = useMemo(() => {
    let list = videos.length > 0 ? [...videos] : video ? [video] : [];
    // Ensure uniqueness
    const seen = new Set<string>();
    list = list.filter(v => {
      if (!v || !v.videoId || seen.has(v.videoId)) return false;
      seen.add(v.videoId);
      return true;
    });
    // If still empty but fallback video exists
    if (list.length === 0 && video) {
      list = [video];
    }
    return list;
  }, [videos, video]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  // If video prop changes externally, update index
  useEffect(() => {
    if (video && playlist.length > 0) {
      const foundIdx = playlist.findIndex(v => v.videoId === video.videoId);
      if (foundIdx !== -1) {
        setCurrentIndex(foundIdx);
      }
    }
  }, [video, playlist]);

  // Clamp currentIndex if playlist shrinks
  useEffect(() => {
    if (currentIndex >= playlist.length && playlist.length > 0) {
      setCurrentIndex(0);
    }
  }, [currentIndex, playlist.length]);

  const activeVideo = playlist[currentIndex] || video;

  // Auto-rotation every 4 seconds, paused on hover
  useEffect(() => {
    if (playlist.length <= 1 || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % playlist.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [playlist.length, isHovered]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (playlist.length <= 1) return;
    setCurrentIndex(prev => (prev - 1 + playlist.length) % playlist.length);
  }, [playlist.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (playlist.length <= 1) return;
    setCurrentIndex(prev => (prev + 1) % playlist.length);
  }, [playlist.length]);

  // Touch swipe support for tablets and mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartXRef.current = null;
  };

  // Get metadata for active video
  const activeDetails = useMemo(() => {
    if (!activeVideo || !allMovieDetails) return null;
    return allMovieDetails.get(activeVideo.videoId) || null;
  }, [activeVideo, allMovieDetails]);

  const displayTitle = useMemo(() => {
    if (!activeVideo) return '';
    if (activeDetails?.title && typeof activeDetails.title === 'string') {
      const trimmed = activeDetails.title.trim();
      if (trimmed.length > 0 && trimmed.toLowerCase() !== 'n/a') {
        return trimmed;
      }
    }
    return cleanTitle(activeVideo.title) || activeVideo.title;
  }, [activeVideo, activeDetails]);

  const genresText = useMemo(() => {
    if (activeDetails?.genres && Array.isArray(activeDetails.genres)) {
      return activeDetails.genres.filter((g: string) => g && g !== 'N/A').slice(0, 3).join(' • ');
    }
    return null;
  }, [activeDetails]);

  if (!activeVideo) return null;

  return (
    <div 
      className="relative h-[48vh] sm:h-[52vh] md:h-[56vh] min-h-[410px] md:min-h-[440px] max-h-[560px] w-full overflow-hidden bg-netflix-black select-none flex flex-col justify-between pt-20 md:pt-24 pb-2 sm:pb-3"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. BLURRY FULL-SIZE BACKGROUND LAYER */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeVideo.videoId || activeVideo.id}
            initial={{ opacity: 0, scale: 1.15 }}
            animate={{ opacity: 1, scale: 1.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 h-full w-full"
          >
            <div className="absolute inset-0 filter blur-[40px] md:blur-[70px] brightness-[0.32] saturate-[1.6]">
              <Thumbnail
                videoSrc={activeVideo.thumbnail}
                alt={activeVideo.title}
                quality="high"
                className="w-full h-full object-cover"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Ambient gradients to blend seamlessly into Netflix UI */}
        <div className="absolute inset-x-0 top-0 h-28 md:h-36 bg-gradient-to-b from-netflix-black via-netflix-black/60 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-36 md:h-48 bg-gradient-to-t from-netflix-black via-netflix-black/85 to-transparent z-10" />
        <div className="absolute inset-0 bg-radial-[circle_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%] z-10" />
      </div>

      {/* 2. FOREGROUND COVERFLOW CAROUSEL */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full px-2 sm:px-6">
        {/* Navigation Arrow Left */}
        {playlist.length > 1 && (
          <button
            onClick={handlePrev}
            aria-label="Vorheriger Film"
            className="absolute left-2 sm:left-4 md:left-8 z-40 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-110 active:scale-95 shadow-2xl focus:outline-none"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* 3D CoverFlow Stage */}
        <div 
          className="relative w-full h-[180px] sm:h-[220px] md:h-[260px] lg:h-[285px] flex items-center justify-center"
          style={{ perspective: '1100px', transformStyle: 'preserve-3d' }}
        >
          {playlist.map((item, index) => {
            const count = playlist.length;
            // Calculate cyclic offset
            let diff = (index - currentIndex) % count;
            if (diff > count / 2) diff -= count;
            if (diff < -count / 2) diff += count;

            const isCenter = diff === 0;
            const isVisible = Math.abs(diff) <= 3;

            if (!isVisible && count > 7) return null;

            // Responsive offset calculations
            const rotationY = diff === 0 ? 0 : diff > 0 ? -36 - (diff - 1) * 8 : 36 - (diff + 1) * 8;
            const scale = diff === 0 ? 1 : Math.max(0.65, 0.86 - Math.abs(diff) * 0.12);
            const translatePercent = diff * 58; // percentage spacing
            const translateZ = diff === 0 ? 80 : -40 - Math.abs(diff) * 60;
            const zIndex = 30 - Math.abs(diff) * 5;
            const opacity = diff === 0 ? 1 : Math.max(0.2, 0.7 - (Math.abs(diff) - 1) * 0.35);

            return (
              <div
                key={item.videoId || item.id}
                onClick={() => {
                  if (isCenter) {
                    onPlay(item);
                  } else {
                    setCurrentIndex(index);
                  }
                }}
                className={`absolute transition-all duration-500 ease-out cursor-pointer origin-center ${
                  isCenter ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-pointer hover:opacity-100'
                }`}
                style={{
                  transform: `translateX(${translatePercent}%) translateZ(${translateZ}px) rotateY(${rotationY}deg) scale(${scale})`,
                  zIndex,
                  opacity,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* 16:9 Card with crisp, unclipped thumbnail */}
                <div className="relative w-[240px] sm:w-[320px] md:w-[390px] lg:w-[440px] xl:w-[460px] aspect-video rounded-xl overflow-hidden bg-zinc-950 shadow-[0_15px_40px_rgba(0,0,0,0.85)] ring-1 ring-white/15 group">
                  <Thumbnail
                    videoSrc={item.thumbnail}
                    alt={item.title}
                    quality={isCenter ? 'high' : 'medium'}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Play Overlay Icon on hover or on active card */}
                  {isCenter && (
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-netflix-red/90 text-white flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="fill-current w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Subtle inner top highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                </div>

                {/* CoverFlow Mirror Reflection Underneath */}
                <div 
                  className="pointer-events-none absolute -bottom-[32%] left-0 right-0 h-[28%] overflow-hidden opacity-25 [transform:scaleY(-1)] blur-[0.5px]"
                  style={{
                    WebkitMaskImage: 'linear-gradient(to top, transparent 15%, rgba(0,0,0,0.8) 100%)',
                    maskImage: 'linear-gradient(to top, transparent 15%, rgba(0,0,0,0.8) 100%)'
                  }}
                >
                  <Thumbnail
                    videoSrc={item.thumbnail}
                    alt={item.title}
                    quality="medium"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Arrow Right */}
        {playlist.length > 1 && (
          <button
            onClick={handleNext}
            aria-label="Nächster Film"
            className="absolute right-2 sm:right-4 md:right-8 z-40 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-110 active:scale-95 shadow-2xl focus:outline-none"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* 3. ACTIVE MOVIE INFO & ACTION BUTTONS */}
      <div className="relative z-30 flex flex-col items-center text-center px-4 md:px-12 max-w-4xl mx-auto space-y-1.5 sm:space-y-2">
        {/* Title */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeVideo.videoId || activeVideo.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center"
          >
            <h2 className="text-lg sm:text-xl md:text-2xl font-extrabold text-white tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] max-w-2xl line-clamp-1">
              {displayTitle}
            </h2>

            {/* Badges / Metadata row */}
            <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-gray-300 mt-0.5 font-medium">
              {activeDetails?.year && (
                <span className="flex items-center text-gray-200">
                  <Calendar className="w-3 h-3 mr-1 text-gray-400" />
                  {activeDetails.year}
                </span>
              )}
              {activeDetails?.year && genresText && <span>•</span>}
              {genresText && (
                <span className="text-gray-300">{genresText}</span>
              )}
              <span className="text-[10px] px-1.5 py-0.2 border border-white/30 rounded text-gray-300 uppercase">
                HD
              </span>
              {activeDetails?.rating && (
                <span className="flex items-center text-yellow-400 font-bold ml-1">
                  <Star className="w-3 h-3 fill-current mr-0.5" />
                  {activeDetails.rating}
                </span>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5 pt-0.5">
          <button
            onClick={() => onPlay(activeVideo)}
            className="flex items-center space-x-1.5 rounded-md bg-white px-4 sm:px-6 py-1.5 sm:py-2 text-black font-bold text-xs sm:text-sm transition-all hover:bg-white/85 active:scale-95 shadow-[0_8px_20px_rgba(0,0,0,0.6)] cursor-pointer"
          >
            <Play className="fill-current w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Abspielen</span>
          </button>
          <button 
            onClick={() => onInfo(activeVideo)}
            className="flex items-center space-x-1.5 rounded-md bg-zinc-800/80 hover:bg-zinc-700/80 px-4 sm:px-5 py-1.5 sm:py-2 text-white font-semibold text-xs sm:text-sm backdrop-blur-md transition-all active:scale-95 border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.6)] cursor-pointer"
          >
            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-200" />
            <span>Infos</span>
          </button>
        </div>

        {/* Carousel Dot Indicators */}
        {playlist.length > 1 && (
          <div className="flex items-center space-x-1.5 pt-1">
            {playlist.slice(0, 15).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Gehe zu Film ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx 
                    ? 'w-5 bg-netflix-red shadow-sm' 
                    : 'w-1.5 bg-white/30 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
