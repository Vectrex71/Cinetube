import React, { useEffect } from 'react';
import YouTube from 'react-youtube';
import { X } from 'lucide-react';
import { YouTubeVideo } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { requestWakeLock } from '../services/wakeLock';

interface PlayerModalProps {
  video: YouTubeVideo | null;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({ video, onClose }) => {
  useEffect(() => {
    if (video) {
      requestWakeLock();
    }
  }, [video]);

  return (
    <AnimatePresence>
      {video && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 md:p-8"
        >
          <button
            onClick={onClose}
            className="absolute right-6 top-6 z-50 rounded-full bg-netflix-black p-2 text-white transition hover:bg-white/10"
          >
            <X size={32} />
          </button>

          <div className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-xl bg-black shadow-2xl">
            <YouTube
              videoId={video.videoId}
              className="h-full w-full"
              iframeClassName="h-full w-full"
              onPlay={() => requestWakeLock()}
              opts={{
                playerVars: {
                  autoplay: 1,
                  modestbranding: 1,
                  rel: 0,
                  playsinline: 1,
                },
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
