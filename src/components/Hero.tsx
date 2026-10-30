import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { YouTubeVideo } from '../types';
import { Play, Info, ChevronLeft, ChevronRight, Star, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cleanTitle, getValidMovieTitle, normalizeGenre, isExcludedGenre } from '../lib/utils';
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
    return getValidMovieTitle(activeDetails?.title, activeVideo.title);
  }, [activeVideo, activeDetails]);

  const genresText = useMemo(() => {
    if (activeDetails?.genres && Array.isArray(activeDetails.genres)) {
      const valid = Array.from(new Set(
        activeDetails.genres
          .filter((g: string) => g && g !== 'N/A')
          .map((g: string) => normalizeGenre(g))
          .filter((g: string) => !isExcludedGenre(g))
      ));
      return valid.slice(0, 3).join(' • ');
    }
    return null;
  }, [activeDetails]);

  if (!activeVideo) return null;

  return (
    <div 
      className="relative h-[56vh] sm:h-[60vh] md:h-[64vh] min-h-[500px] sm:min-h-[540px] md:min-h-[580px] max-h-[660px] w-full overflow-hidden bg-netflix-black select-none flex flex-col justify-center pt-28 sm:pt-32 md:pt-36 pb-20 sm:pb-24"
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
        <div className="absolute inset-x-0 bottom-0 h-32 md:h-44 bg-gradient-to-t from-netflix-black via-netflix-black/85 to-transparent z-10" />
        <div className="absolute inset-0 bg-radial-[circle_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%] z-10" />
      </div>

      {/* 2. FOREGROUND COVERFLOW CAROUSEL - Shifted down for generous breathing room from top bar */}
      <div className="relative z-20 flex-1 flex items-center justify-center w-full px-2 sm:px-6 translate-y-3 sm:translate-y-5 md:translate-y-6">
        {/* Navigation Arrow Left */}
        {playlist.length > 1 && (
          <button
            onClick={handlePrev}
            aria-label="Vorheriger Film"
            className="absolute left-2 sm:left-4 md:left-8 z-40 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-110 active:scale-95 shadow-2xl focus:outline-none cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}

        {/* 3D CoverFlow Stage */}
        <div 
          className="relative w-full h-[200px] sm:h-[240px] md:h-[275px] lg:h-[300px] flex items-center justify-center"
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
            // Active center card is prominently larger (scale 1.18) and pulled forward
            const scale = diff === 0 ? 1.18 : Math.max(0.60, 0.78 - Math.abs(diff) * 0.1);
            const translateY = diff === 0 ? 10 : 0;
            const translatePercent = diff * 54; // percentage spacing
            const translateZ = diff === 0 ? 105 : -45 - Math.abs(diff) * 60;
            const zIndex = isCenter ? 35 : 28 - Math.abs(diff) * 5;
            const opacity = diff === 0 ? 1 : Math.max(0.2, 0.65 - (Math.abs(diff) - 1) * 0.3);

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
                  isCenter ? 'hover:scale-[1.04]' : 'hover:opacity-100'
                }`}
                style={{
                  transform: `translateX(${translatePercent}%) translateY(${translateY}px) translateZ(${translateZ}px) rotateY(${rotationY}deg) scale(${scale})`,
                  zIndex,
                  opacity,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* 16:9 Card with crisp, unclipped thumbnail */}
                <div className={`relative w-[230px] sm:w-[300px] md:w-[370px] lg:w-[420px] xl:w-[460px] aspect-video rounded-2xl overflow-hidden bg-zinc-950 transition-all duration-500 ${
                  isCenter 
                    ? 'ring-2 ring-white/35 shadow-[0_30px_70px_rgba(0,0,0,0.95),_0_0_35px_rgba(255,255,255,0.1)]' 
                    : 'ring-1 ring-white/15 shadow-[0_15px_40px_rgba(0,0,0,0.85)]'
                } group`}>
                  <Thumbnail
                    videoSrc={item.thumbnail}
                    alt={item.title}
                    quality={isCenter ? 'high' : 'medium'}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  {/* Play Overlay Icon on hover on active card */}
                  {isCenter && (
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-netflix-red/90 text-white flex items-center justify-center shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="fill-current w-5 h-5 sm:w-6 sm:h-6 ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Subtle inner top highlight */}
                  <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                </div>

                {/* CoverFlow Mirror Reflection Underneath */}
                <div 
                  className={`pointer-events-none absolute left-0 right-0 overflow-hidden ${
                    isCenter ? 'opacity-10 -bottom-[22%] h-[18%]' : 'opacity-22 -bottom-[30%] h-[26%]'
                  } [transform:scaleY(-1)] blur-[0.5px]`}
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
            className="absolute right-2 sm:right-4 md:right-8 z-40 p-2 sm:p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-110 active:scale-95 shadow-2xl focus:outline-none cursor-pointer"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        )}
      </div>

      {/* 3. HERO CONTROLS & MOVIE TITLE (Positioned absolutely at bottom so 2-line/3-line titles never push the Coverflow up) */}
      <div className="absolute bottom-0 inset-x-0 z-35 w-full px-4 sm:px-8 md:px-12 pb-3 sm:pb-4 pointer-events-auto">
        <div className="w-full flex items-end justify-between gap-4 sm:gap-8">
          {/* Left Side: Action Buttons & Carousel Dots */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 shrink-0 pb-1">
            <button
              onClick={() => onPlay(activeVideo)}
              className="flex items-center space-x-1.5 sm:space-x-2 rounded-lg bg-white px-4 sm:px-6 py-2 text-black font-extrabold text-xs sm:text-sm transition-all hover:bg-white/90 hover:scale-105 active:scale-95 shadow-[0_4px_20px_rgba(0,0,0,0.8)] cursor-pointer shrink-0"
            >
              <Play className="fill-current w-3.5 h-3.5 sm:w-4 sm:h-4 text-black" />
              <span>Abspielen</span>
            </button>

            <button 
              onClick={() => onInfo(activeVideo)}
              className="flex items-center space-x-1.5 sm:space-x-2 rounded-lg bg-zinc-900/80 hover:bg-zinc-800/90 px-3.5 sm:px-5 py-2 text-white font-semibold text-xs sm:text-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 border border-white/20 shadow-lg cursor-pointer shrink-0"
            >
              <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-200" />
              <span>Infos</span>
            </button>

            {/* Carousel Dot Indicators */}
            {playlist.length > 1 && (
              <div className="hidden md:flex items-center space-x-1.5 pl-3 border-l border-white/15">
                {playlist.slice(0, 12).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Gehe zu Film ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      currentIndex === idx 
                        ? 'w-4 bg-netflix-red shadow-sm' 
                        : 'w-1.5 bg-white/30 hover:bg-white/60'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Movie Title & Metadata - Perfectly bounded & harmonious */}
          <div className="flex flex-col items-end text-right min-w-0 max-w-[280px] sm:max-w-[360px] md:max-w-[430px] lg:max-w-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeVideo.videoId || activeVideo.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-end text-right w-full"
              >
                {/* Title - Refined size, balanced line wrap, never clips or collides */}
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-black text-white tracking-tight drop-shadow-[0_4px_16px_rgba(0,0,0,1)] line-clamp-2 sm:line-clamp-3 leading-snug text-balance">
                  {displayTitle}
                </h2>

                {/* Badges / Metadata row aligned right */}
                <div className="flex items-center space-x-2 text-[11px] sm:text-xs text-gray-300 font-medium justify-end mt-1 sm:mt-1.5 flex-wrap gap-y-0.5 drop-shadow-md">
                  {activeDetails?.year && (
                    <span className="flex items-center text-gray-200">
                      <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 text-gray-400" />
                      {activeDetails.year}
                    </span>
                  )}
                  {activeDetails?.year && genresText && <span className="text-gray-500">•</span>}
                  {genresText && (
                    <span className="text-gray-300 truncate max-w-[160px] sm:max-w-[240px] md:max-w-[300px]">{genresText}</span>
                  )}
                  <span className="text-[10px] px-1.5 py-0.2 border border-white/30 rounded text-gray-300 uppercase font-semibold">
                    HD
                  </span>
                  {Boolean(typeof activeDetails?.rating === 'number' && activeDetails.rating > 0) && (
                    <span className="flex items-center text-yellow-400 font-bold ml-0.5">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current mr-0.5" />
                      {activeDetails.rating}
                    </span>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
