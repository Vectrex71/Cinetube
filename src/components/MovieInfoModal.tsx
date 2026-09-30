import React, { useEffect, useState } from 'react';
import { YouTubeVideo } from '../types';
import { X, Star, Calendar, Clock, ExternalLink, Loader2, RefreshCw, Edit2, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fetchMovieInfo, MovieDetails } from '../services/movieInfo';
import { cleanTitle } from '../lib/utils';
import { getDbInstance, doc, updateDoc, setDoc } from '../firebase';

interface MovieInfoModalProps {
  video: YouTubeVideo | null;
  onClose: () => void;
  onGenreClick?: (genre: string) => void;
  isAdmin?: boolean;
}

export const MovieInfoModal: React.FC<MovieInfoModalProps> = ({ video, onClose, onGenreClick, isAdmin }) => {
  const [details, setDetails] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditingGenres, setIsEditingGenres] = useState(false);
  const [newGenre, setNewGenre] = useState('');
  const [editingSearchTitle, setEditingSearchTitle] = useState(false);
  const [customSearchTitleInput, setCustomSearchTitleInput] = useState('');

  useEffect(() => {
    if (details) {
      setCustomSearchTitleInput(details.customSearchTitle || '');
    } else {
      setCustomSearchTitleInput('');
    }
  }, [details]);

  const handleSaveSearchTitle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!video) return;
    
    setLoading(true);
    try {
      const dbRef = getDbInstance();
      const cacheRef = doc(dbRef, 'movieDetails', video.videoId);
      const newSearchTitle = customSearchTitleInput.trim();
      
      await setDoc(cacheRef, {
        customSearchTitle: newSearchTitle || null
      }, { merge: true });
      
      const info = await fetchMovieInfo(video.title, video.videoId, true);
      setDetails(info);
      setEditingSearchTitle(false);
    } catch (error) {
      console.error("Fehler beim Speichern des Suchbegriffs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGenres = async (updatedGenres: string[]) => {
    if (!video || !details) return;
    try {
      const dbRef = getDbInstance();
      const cacheRef = doc(dbRef, 'movieDetails', video.videoId);
      await updateDoc(cacheRef, {
        genres: updatedGenres
      });
      setDetails({ ...details, genres: updatedGenres });
    } catch (error) {
      console.error("Fehler beim Speichern der Kategorien:", error);
    }
  };

  const handleRemoveGenre = (genreToRemove: string) => {
    if (!details) return;
    const updated = (details.genres || []).filter(g => g !== genreToRemove);
    handleSaveGenres(updated);
  };

  const handleAddGenre = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!details || !newGenre.trim()) return;
    const updated = [...(details.genres || []), newGenre.trim()];
    handleSaveGenres(updated);
    setNewGenre('');
  };

  const loadDetails = async (forceRefresh = false) => {
    if (video) {
        setLoading(true);
        const info = await fetchMovieInfo(video.title, video.videoId, forceRefresh);
        setDetails(info);
        setLoading(false);
    }
  };

  useEffect(() => {
    if (video) {
      loadDetails();
    } else {
      setDetails(null);
    }
  }, [video]);

  return (
    <AnimatePresence>
      {video && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm md:py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-netflix-black shadow-2xl no-scrollbar"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="fixed right-6 top-8 z-[110] rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 md:absolute md:right-4 md:top-4"
            >
              <X size={24} />
            </button>

            <div className="flex flex-col md:flex-row">
              {/* Poster/Thumbnail */}
              <div className="w-full md:w-1/3">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="aspect-video w-full object-cover md:aspect-auto md:h-full"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Content */}
              <div className="flex flex-1 flex-col p-6 md:p-8">
                {loading ? (
                  <div className="flex h-full items-center justify-center py-20">
                    <Loader2 className="animate-spin text-netflix-red" size={48} />
                  </div>
                ) : details ? (
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-3xl font-bold text-white md:text-4xl flex flex-wrap items-center gap-2">
                        <span>{details.title || cleanTitle(video.title)}</span>
                      </h2>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center space-x-1 text-yellow-500">
                          <Star size={16} className="fill-current" />
                          <span className="font-bold">{typeof details.rating === 'number' ? details.rating.toFixed(1) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar size={16} />
                          <span>{details.releaseDate || 'Unbekannt'}</span>
                        </div>
                        {details.runtime && details.runtime !== 'N/A' && (
                          <div className="flex items-center space-x-1">
                            <Clock size={16} />
                            <span>{details.runtime}</span>
                          </div>
                        )}
                      </div>
                    </div>
 
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditingGenres ? (
                          (details.genres || []).map((genre, idx) => (
                            <span
                              key={`${genre}-${idx}`}
                              className="group flex items-center rounded-full border border-gray-600 bg-gray-700/50 px-3 py-1 text-xs font-medium text-gray-200"
                            >
                              {genre}
                              <button
                                onClick={() => handleRemoveGenre(genre)}
                                className="ml-2 rounded-full p-0.5 text-gray-400 hover:bg-red-500 hover:text-white"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))
                        ) : (
                          (() => {
                            const excludedGenres = [
                              'christlicher film', 'dokumentation', 'glaube', 'glauben', 
                              'fernsehfilm', 'found footage', 'dystopie', 'information', 
                              'kampfsport', 'privat', 'unbekannt', 'cast', 'tv-film',
                              'anthologie'
                            ];
                            const mapping: Record<string, string> = {
                              'historie': 'Historienfilm',
                              'musical': 'Musikfilm',
                              'music': 'Musikfilm',
                              'musik': 'Musikfilm',
                              'romanze': 'Romantik',
                              'science fiction': 'Sci-Fi',
                              'scince fiction': 'Sci-Fi',
                              'science-fiction': 'Sci-Fi',
                              'kom$die': 'Komödie'
                            };

                            if (!Array.isArray(details.genres)) return null;

                            const displayedGenres = Array.from(new Set(
                              details.genres
                                .filter(g => g && g !== 'N/A')
                                .map(g => {
                                  const lowerG = g.toLowerCase().trim();
                                  return mapping[lowerG] || g;
                                })
                                .filter(g => {
                                  const lowerG = g.toLowerCase().trim();
                                  return !excludedGenres.includes(lowerG);
                                })
                            ));

                            return displayedGenres.map((genre) => (
                              <button
                                key={genre}
                                onClick={() => onGenreClick?.(genre)}
                                className="rounded-full border border-gray-700 bg-gray-800/50 px-3 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
                              >
                                {genre}
                              </button>
                            ));
                          })()
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => setIsEditingGenres(!isEditingGenres)}
                            className={`ml-1 rounded-full p-1.5 transition ${isEditingGenres ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                            title="Kategorien bearbeiten"
                          >
                            {isEditingGenres ? <Check size={14} /> : <Edit2 size={14} />}
                          </button>
                        )}
                      </div>
                      <AnimatePresence>
                        {isEditingGenres && (
                          <motion.form 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            onSubmit={handleAddGenre}
                            className="flex items-center gap-2 mt-1"
                          >
                            <input
                              type="text"
                              value={newGenre}
                              onChange={(e) => setNewGenre(e.target.value)}
                              placeholder="Neue Kategorie hinzufügen..."
                              className="rounded-md border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full max-w-[200px]"
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-white p-1.5 text-black hover:bg-gray-200"
                              title="Hinzufügen"
                            >
                              <Plus size={18} />
                            </button>
                          </motion.form>
                        )}
                      </AnimatePresence>
                    </div>
 
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-white">Beschreibung</h3>
                      <p className="leading-relaxed text-gray-300">
                        {details.overview && details.overview !== 'N/A' ? details.overview : 'Keine Beschreibung verfügbar.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {(details.director && details.director !== 'N/A') && (
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Regie</h4>
                          <p className="text-gray-200">{details.director}</p>
                        </div>
                      )}
                      {(Array.isArray(details.cast) && details.cast.length > 0 && details.cast[0] !== 'N/A') && (
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Besetzung</h4>
                          <p className="text-gray-200 line-clamp-2">
                            {details.cast.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 pt-4">
                      {details.tmdbUrl && (
                        <a
                          href={details.tmdbUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-sm font-medium text-netflix-red transition hover:text-red-500 hover:underline"
                        >
                          <span>Auf TMDB ansehen</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {details.germanInfoUrl && (
                        <a
                          href={details.germanInfoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-2 text-sm font-medium text-netflix-red transition hover:text-red-500 hover:underline"
                        >
                          <span>Auf Filmstarts/Moviepilot ansehen</span>
                          <ExternalLink size={14} />
                        </a>
                      )}
                      {isAdmin && (
                        <div className="w-full mt-6 border-t border-gray-800 pt-6 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <button
                              onClick={() => setEditingSearchTitle(!editingSearchTitle)}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition"
                            >
                              <Edit2 size={12} />
                              <span>Suchtitel anpassen / korrigieren</span>
                            </button>
                            <button
                              onClick={() => loadDetails(true)}
                              className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-300 transition"
                            >
                              <RefreshCw size={12} />
                              <span>AI Infos neu laden</span>
                            </button>
                          </div>
                          
                          {editingSearchTitle && (
                            <motion.form 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              onSubmit={handleSaveSearchTitle}
                              className="rounded-lg bg-gray-900/40 border border-gray-800 p-4 space-y-3"
                            >
                              <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-300">
                                  Such-Titel für Filminfos anpassen:
                                </label>
                                <p className="text-[10px] text-gray-500">
                                  Falls der YouTube-Titel zu kompliziert ist, gib hier den reinen Filmnamen an. Die AI-Suche verwendet dann exakt diesen Namen.
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={customSearchTitleInput}
                                  onChange={(e) => setCustomSearchTitleInput(e.target.value)}
                                  placeholder={details?.customSearchTitle || cleanTitle(video?.title || '')}
                                  className="flex-1 rounded border border-gray-700 bg-black/40 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                                />
                                <button
                                  type="submit"
                                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition whitespace-nowrap"
                                >
                                  Speichern & Suchen
                                </button>
                              </div>
                            </motion.form>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
                    <p className="text-gray-400 max-w-md">
                      Leider konnten keine weiteren Informationen zu diesem Titel gefunden werden. 
                      Das liegt meistens an einem zu komplexen YouTube-Titel oder ungewollten Sonderzeichen.
                    </p>
                    
                    {isAdmin && (
                      <div className="w-full max-w-md rounded-lg border border-gray-800 bg-gray-900/50 p-5 text-left space-y-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                            <Edit2 size={14} className="text-blue-400" />
                            Such-Titel für Filminfos optimieren
                          </h4>
                          <p className="text-xs text-gray-500">
                            Gib hier den einfachen, korrekten Filmtitel ein (z.B. "Memory Effect"). Die App sucht dann gezielt nach diesem Begriff.
                          </p>
                        </div>
                        <form onSubmit={handleSaveSearchTitle} className="flex gap-2">
                          <input
                            type="text"
                            value={customSearchTitleInput}
                            onChange={(e) => setCustomSearchTitleInput(e.target.value)}
                            placeholder="Einfacher Filmtitel (z.B. Memory Effect)"
                            className="flex-1 rounded-md border border-gray-750 bg-black/50 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 whitespace-nowrap"
                          >
                            Speichern & Suchen
                          </button>
                        </form>
                      </div>
                    )}

                    <div className="flex space-x-4 justify-center">
                      <button
                        onClick={onClose}
                        className="rounded bg-white px-6 py-2 font-semibold text-black transition hover:bg-white/80"
                      >
                        Schließen
                      </button>
                      {(!isAdmin || !customSearchTitleInput) && (
                        <button
                          onClick={() => loadDetails(true)}
                          className="rounded bg-gray-800 px-6 py-2 font-semibold text-white transition hover:bg-gray-700 flex items-center space-x-2"
                        >
                          <RefreshCw size={18} />
                          <span>Neu laden</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
