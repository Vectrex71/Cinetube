import React, { useRef } from 'react';
import { YouTubeVideo } from '../types';
import { ChevronLeft, ChevronRight, EyeOff, Plus, Bookmark, Info, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { Thumbnail } from './Thumbnail';

interface MovieRowProps {
  title: string;
  videos: YouTubeVideo[];
  onSelect: (video: YouTubeVideo) => void;
  onInfo: (video: YouTubeVideo) => void;
  isAdmin?: boolean;
  onHide?: (videoId: string) => void;
  onSeeAll?: () => void;
  myListIds?: Set<string>;
  onToggleMyList?: (videoId: string) => void;
  recommendedIds?: Set<string>;
  onToggleRecommendation?: (videoId: string) => void;
}

export const MovieRow: React.FC<MovieRowProps> = ({ 
  title, 
  videos, 
  onSelect, 
  onInfo, 
  isAdmin, 
  onHide, 
  onSeeAll, 
  myListIds, 
  onToggleMyList,
  recommendedIds,
  onToggleRecommendation
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollAmount = clientWidth * 0.8;
      const scrollTo = direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount;
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (videos.length === 0) return null;

  return (
    <div className="space-y-2 px-4 md:px-12 py-4 md:py-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg md:text-2xl font-semibold text-gray-200">{title}</h2>
        {onSeeAll && (
          <button 
            onClick={onSeeAll}
            className="text-xs md:text-sm font-medium text-netflix-red transition hover:text-red-500 hover:underline"
          >
            Alle anzeigen ›
          </button>
        )}
      </div>
      <div className="group relative">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-40 m-auto h-full w-8 md:w-12 cursor-pointer bg-black/50 opacity-0 transition hover:scale-125 group-hover:opacity-100"
        >
          <ChevronLeft size={30} className="md:w-[40px]" />
        </button>
 
        <div
          ref={rowRef}
          className="no-scrollbar flex items-center space-x-2 md:space-x-2.5 overflow-x-scroll scrollbar-hide scroll-smooth"
        >
          {videos.map((video) => (
            <div
              key={video.id}
              onClick={() => onSelect(video)}
              className="group relative isolate h-28 min-w-[180px] md:h-36 md:min-w-[260px] cursor-pointer transition-transform duration-200 ease-out md:hover:scale-105 hover:z-20 z-0"
            >
              <div className="relative h-full w-full overflow-hidden rounded-md shadow-md">
                <Thumbnail
                  videoSrc={video.thumbnail}
                  alt={video.title}
                  loading="lazy"
                />
                
                {/* Action Buttons Overlay */}
                <div className="absolute right-1.5 bottom-1.5 md:right-2 md:bottom-2 z-10 flex space-x-1.5 md:space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onInfo(video);
                    }}
                    className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-white hover:text-black hover:scale-110 shadow-lg"
                    title="Weitere Infos"
                  >
                    <Info size={15} className="md:w-[18px] md:h-[18px]" />
                  </button>
                  {onToggleMyList && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMyList(video.videoId);
                      }}
                    className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-white hover:text-black hover:scale-110 shadow-lg"
                    title={myListIds?.has(video.videoId) ? "Von meiner Liste entfernen" : "Zu meiner Liste hinzufügen"}
                  >
                    {myListIds?.has(video.videoId) ? <Bookmark size={15} className="md:w-[18px] md:h-[18px] fill-current" /> : <Plus size={15} className="md:w-[18px] md:h-[18px]" />}
                  </button>
                  )}
                </div>

                {isAdmin && onToggleRecommendation && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRecommendation(video.videoId);
                    }}
                    className={cn(
                      "absolute left-1.5 top-1.5 md:left-2 md:top-2 z-10 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-110",
                      recommendedIds?.has(video.videoId) ? "bg-yellow-600" : "bg-black/80 hover:bg-yellow-600"
                    )}
                    title={recommendedIds?.has(video.videoId) ? "Aus Empfehlungen entfernen" : "Zu Empfehlungen hinzufügen"}
                  >
                    <Trophy size={14} className={cn("md:w-4 md:h-4", recommendedIds?.has(video.videoId) ? "fill-current" : "")} />
                  </button>
                )}

                {isAdmin && onHide && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onHide(video.videoId);
                    }}
                    className="absolute left-10 md:left-12 top-1.5 md:top-2 z-10 flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-full bg-black/80 text-white shadow-lg transition hover:bg-netflix-red hover:scale-110"
                    title="Video ausblenden"
                  >
                    <EyeOff size={14} className="md:w-4 md:h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-40 m-auto h-full w-8 md:w-12 cursor-pointer bg-black/50 opacity-0 transition hover:scale-125 group-hover:opacity-100"
        >
          <ChevronRight size={30} className="md:w-[40px]" />
        </button>
      </div>
    </div>
  );
};
