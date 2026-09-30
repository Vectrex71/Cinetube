import React from 'react';
import { LogIn, Lock, Film, List } from 'lucide-react';
import { signIn } from '../firebase';

export const LoginWall: React.FC = () => {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 text-center overflow-hidden">
      {/* Cinematic Background Grid */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-30 select-none pointer-events-none">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 scale-110 -rotate-12 translate-y-[-10%] translate-x-[-5%]">
          {[...Array(40)].map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-gray-900 rounded-md shadow-2xl transition-transform duration-700 hover:scale-105">
              <img 
                src={`https://picsum.photos/seed/${i + 123}/300/450`} 
                alt="" 
                className="w-full h-full object-cover rounded-md grayscale-[0.5] hover:grayscale-0 transition-all"
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-tr from-black via-black/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black" />
      </div>

      <div className="z-10 max-w-2xl space-y-10 animate-in fade-in zoom-in duration-1000">
        <div className="space-y-2">
          <h1 className="text-6xl font-black tracking-tighter text-netflix-red md:text-8xl drop-shadow-2xl">CINETUBE</h1>
          <p className="text-white text-lg md:text-xl font-medium tracking-widest uppercase opacity-80">Spielfilme aus YouTube</p>
        </div>
        
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-white md:text-5xl">Entdecke kuratiertes Kino</h2>
          <p className="mx-auto max-w-lg text-lg text-gray-300 md:text-xl leading-relaxed">
            Eine interaktive Mediathek mit intelligenter Filminformation durch Gemini AI, 
            nahtloser YouTube-Integration und personalisierter Watchlist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4">
          <button 
            onClick={signIn}
            className="group flex w-full sm:w-auto items-center justify-center space-x-4 rounded-full bg-netflix-red px-10 py-5 text-xl font-bold text-white shadow-2xl transition-all hover:bg-red-700 hover:scale-105 active:scale-95"
          >
            <LogIn size={24} />
            <span>Jetzt erkunden</span>
          </button>
        </div>

        <div className="flex flex-wrap justify-center gap-8 pt-8">
          <span className="flex items-center space-x-2 text-gray-400">
            <Film size={18} className="text-netflix-red" />
            <span className="text-sm border-b border-gray-800 pb-1">KI-Info-Synchronisation</span>
          </span>
          <span className="flex items-center space-x-2 text-gray-400">
            <List size={18} className="text-blue-500" />
            <span className="text-sm border-b border-gray-800 pb-1">Persönliche Watchlist</span>
          </span>
          <span className="flex items-center space-x-2 text-gray-400">
            <Lock size={18} className="text-yellow-500" />
            <span className="text-sm border-b border-gray-800 pb-1">Geschützter Admin-Bereich</span>
          </span>
        </div>
      </div>
    </div>
  );
};
