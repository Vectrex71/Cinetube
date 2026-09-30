import React, { useMemo } from 'react';
import { YouTubeVideo } from '../types';
import { Play, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cleanTitle } from '../lib/utils';
import { Thumbnail } from './Thumbnail';

interface HeroProps {
  video: YouTubeVideo;
  onPlay: (video: YouTubeVideo) => void;
  onInfo: (video: YouTubeVideo) => void;
}

export const Hero: React.FC<HeroProps> = ({ video, onPlay, onInfo }) => {
  const displayTitle = useMemo(() => cleanTitle(video.title), [video.title]);

  return (
    <div className="relative h-[65vh] md:h-[75vh] w-full overflow-hidden bg-netflix-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={video.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ 
            duration: 0.8,
            ease: [0.16, 1, 0.3, 1]
          }}
          className="absolute inset-x-0 h-full w-full"
        >
          <div className="absolute inset-0">
            <Thumbnail
              videoSrc={video.thumbnail}
              alt={video.title}
              quality="high"
              className="transition-transform duration-[10000ms]"
            />
            {/* Subtle Glint Effect */}
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{ 
                delay: 2, 
                duration: 2.5, 
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 5
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none z-10"
            />
            <div className="absolute inset-x-0 bottom-0 h-24 md:h-32 bg-gradient-to-t from-netflix-black to-transparent" />
            <div className="absolute inset-x-0 top-0 h-24 md:h-32 bg-gradient-to-b from-netflix-black/80 to-transparent" />
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 flex flex-col justify-end pb-4 md:pb-8 px-4 md:px-12 z-20 pointer-events-none">
        <div className="flex space-x-2 md:space-x-3 pointer-events-auto">
          <button
            onClick={() => onPlay(video)}
            className="flex items-center space-x-1.5 md:space-x-2 rounded bg-white px-4 md:px-6 py-1.5 md:py-2 text-black transition hover:bg-white/80 active:scale-95 shadow-xl"
          >
            <Play className="fill-current w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-xs md:text-sm font-bold">Abspielen</span>
          </button>
          <button 
            onClick={() => onInfo(video)}
            className="flex items-center space-x-1.5 md:space-x-2 rounded bg-gray-500/60 px-4 md:px-6 py-1.5 md:py-2 text-white transition hover:bg-gray-500/40 active:scale-95 backdrop-blur-md shadow-xl border border-white/5"
          >
            <Info className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span className="text-xs md:text-sm font-bold">Infos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
