import React, { useMemo, useState, useEffect } from 'react';
import { YouTubeVideo } from '../types';
import { getDbInstance, collection, onSnapshot, query, doc, deleteDoc } from '../firebase';
import { Trash2, Search, ExternalLink, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn, cleanTitle } from '../lib/utils';

interface DifferenceViewProps {
  videos: YouTubeVideo[];
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export function DifferenceView({ videos, onClose, onRefresh }: DifferenceViewProps) {
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const db = getDbInstance();

  const fetchDbIds = async () => {
    const q = query(collection(db, 'movieDetails'));
    // We use a regular getDocs for the manual refresh to be sure, 
    // although onSnapshot is generally enough.
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setCachedIds(ids);
      setLoading(false);
      setRefreshing(false);
    }, (err) => {
      console.error("Error fetching movieDetails IDs:", err);
      setLoading(false);
      setRefreshing(false);
    });
    return unsubscribe;
  };

  useEffect(() => {
    let unsub: () => void;
    fetchDbIds().then(u => unsub = u);
    return () => unsub?.();
  }, [db]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      console.error("Error refreshing playlist items:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const missingVideos = useMemo(() => {
    return videos.filter(v => !cachedIds.has(v.videoId));
  }, [videos, cachedIds]);

  const filteredMissing = useMemo(() => {
    if (!searchQuery.trim()) return missingVideos;
    const q = searchQuery.toLowerCase();
    return missingVideos.filter(v => 
      v.title.toLowerCase().includes(q) || 
      v.videoId.toLowerCase().includes(q)
    );
  }, [missingVideos, searchQuery]);

  // Find actual duplicates (multiple videos with the same title)
  const duplicateTitles = useMemo(() => {
    const titleMap = new Map<string, YouTubeVideo[]>();
    videos.forEach(v => {
      const cleaned = v.title.toLowerCase()
        .split('(')[0]
        .split('[')[0]
        .split('|')[0]
        .trim();
      const list = titleMap.get(cleaned) || [];
      list.push(v);
      titleMap.set(cleaned, list);
    });
    
    return Array.from(titleMap.entries())
      .filter(([_, list]) => list.length > 1)
      .map(([title, list]) => ({ title, list }));
  }, [videos]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-netflix-red" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <h2 className="text-2xl font-bold text-white">Datenbank-Abgleich</h2>
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm transition-all hover:bg-white/10",
              refreshing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span>{refreshing ? 'Aktualisiere...' : 'Jetzt aktualisieren'}</span>
          </button>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          Zurück zur Übersicht
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Missing in Database Section */}
        <section className="space-y-4 rounded-xl bg-black/40 p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-netflix-red">Nicht in Datenbank ({missingVideos.length})</h3>
              <p className="text-sm text-gray-400">Diese YouTube-Videos haben keinen Eintrag in Firestore.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input 
                type="text" 
                placeholder="Suchen..." 
                className="bg-black/60 border border-gray-700 rounded-full py-1.5 pl-9 pr-4 text-xs focus:outline-none focus:ring-1 focus:ring-netflix-red"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredMissing.map(video => (
              <div key={video.videoId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <img src={video.thumbnail} className="h-10 w-16 object-cover rounded shadow" alt="" referrerPolicy="no-referrer" />
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-gray-200 truncate pr-2">{cleanTitle(video.title)}</p>
                    <p className="text-[10px] font-mono text-gray-500">{video.videoId}</p>
                  </div>
                </div>
                <a 
                  href={`https://www.youtube.com/watch?v=${video.videoId}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-500 hover:text-white transition-colors"
                  title="Auf YouTube ansehen"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            ))}
            {filteredMissing.length === 0 && (
              <p className="text-center py-8 text-gray-500 italic">Keine fehlenden Einträge gefunden.</p>
            )}
          </div>
        </section>

        {/* Possible Duplicates Section */}
        <section className="space-y-4 rounded-xl bg-black/40 p-6 border border-gray-800">
          <div>
            <h3 className="text-xl font-bold text-yellow-500">Mögliche Duplikate ({duplicateTitles.length})</h3>
            <p className="text-sm text-gray-400">Mehrere Videos mit (fast) identischem Titel in der Playlist.</p>
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {duplicateTitles.map(({ title, list }) => (
              <div key={title} className="p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
                <h4 className="text-sm font-bold text-yellow-500 mb-3 uppercase tracking-wider">Titel: {title}</h4>
                <div className="space-y-2">
                  {list.map(video => (
                    <div key={video.videoId} className="flex items-center justify-between p-2 bg-black/40 rounded border border-white/5">
                      <div className="flex items-center space-x-3 overflow-hidden">
                        <p className="text-xs text-gray-300 truncate">{cleanTitle(video.title)}</p>
                        <span className="text-[9px] font-mono text-gray-600 bg-black px-1.5 py-0.5 rounded shrink-0">{video.videoId}</span>
                      </div>
                      <a 
                        href={`https://www.youtube.com/watch?v=${video.videoId}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-gray-500 hover:text-white ml-2"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {duplicateTitles.length === 0 && (
              <p className="text-center py-8 text-gray-500 italic">Keine Duplikate gefunden.</p>
            )}
          </div>
        </section>
      </div>
      
      <div className="flex items-center space-x-2 text-sm text-gray-400 bg-netflix-red/10 p-4 rounded-lg border border-netflix-red/20">
        <AlertCircle size={18} className="text-netflix-red shrink-0" />
        <p>
          <strong>Tipp:</strong> Wenn ein Film "Nicht in Datenbank" ist, klicke in der normalen Ansicht auf den (i) Button oder starte den Sync, um Gemini-Informationen zu laden. 
          Filme, die geladen wurden, verschwinden aus dieser Liste. Duplikate sollten manuell aus der YouTube Playlist entfernt werden.
        </p>
      </div>
    </div>
  );
}
