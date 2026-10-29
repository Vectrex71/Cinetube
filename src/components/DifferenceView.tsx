import React, { useMemo, useState, useEffect, useRef } from 'react';
import { YouTubeVideo } from '../types';
import { getDbInstance, collection, onSnapshot, query, doc, deleteDoc } from '../firebase';
import { Trash2, Search, ExternalLink, Loader2, AlertCircle, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn, cleanTitle } from '../lib/utils';
import { fetchMovieInfo } from '../services/movieInfo';

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
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const db = getDbInstance();

  const fetchDbIds = async () => {
    const q = query(collection(db, 'movieDetails'));
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

  const handleSyncSingle = async (video: YouTubeVideo) => {
    if (syncingId || isBatchSyncing) return;
    setSyncingId(video.videoId);
    setSyncFeedback(null);
    try {
      await fetchMovieInfo(video.title, video.videoId, true);
      setSyncFeedback(`"${cleanTitle(video.title)}" erfolgreich in die Datenbank geladen!`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      console.error("Error loading info:", err);
      alert(`Fehler beim Abrufen der Infos für "${video.title}": ${err?.message || 'Unbekannter Fehler'}`);
    } finally {
      setSyncingId(null);
    }
  };

  const cancelBatchSync = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsBatchSyncing(false);
  };

  const handleBatchSyncMissing = async () => {
    if (isBatchSyncing || missingVideos.length === 0) return;
    
    const limit = Math.min(missingVideos.length, 20);
    const toProcess = missingVideos.slice(0, limit);
    
    abortControllerRef.current = new AbortController();
    setIsBatchSyncing(true);
    setBatchProgress({ current: 0, total: limit });
    setSyncFeedback(null);

    let successCount = 0;
    try {
      for (let i = 0; i < toProcess.length; i++) {
        if (abortControllerRef.current.signal.aborted) break;
        const video = toProcess[i];
        setBatchProgress({ current: i + 1, total: limit });
        
        try {
          await fetchMovieInfo(video.title, video.videoId, true);
          successCount++;
        } catch (itemErr: any) {
          console.warn(`Fehler bei ${video.title}:`, itemErr);
          const errMsg = itemErr?.message?.toLowerCase() || '';
          if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('quota')) {
            alert("API-Ratelimit erreicht. Bitte warte kurz vor dem nächsten Durchlauf.");
            break;
          }
        }
        
        // Safety pause between calls to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 3500));
      }
      setSyncFeedback(`${successCount} Filme erfolgreich synchronisiert!`);
      setTimeout(() => setSyncFeedback(null), 5000);
    } catch (err) {
      console.error("Batch sync error:", err);
    } finally {
      setIsBatchSyncing(false);
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

      {syncFeedback && (
        <div className="flex items-center space-x-2 text-sm text-green-300 bg-green-950/60 p-3 rounded-lg border border-green-700/50">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Missing in Database Section */}
        <section className="space-y-4 rounded-xl bg-black/40 p-6 border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-netflix-red">Nicht in Datenbank ({missingVideos.length})</h3>
              <p className="text-sm text-gray-400">Diese YouTube-Videos haben noch keine Filmdaten in Firestore.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {missingVideos.length > 0 && (
                <button
                  onClick={isBatchSyncing ? cancelBatchSync : handleBatchSyncMissing}
                  className={cn(
                    "flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow",
                    isBatchSyncing 
                      ? "bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-600 hover:text-white"
                      : "bg-netflix-red text-white hover:bg-red-700"
                  )}
                  title={isBatchSyncing ? "Batch-Synchronisierung abbrechen" : "Bis zu 20 fehlende Filme nacheinander per KI abrufen"}
                >
                  {isBatchSyncing ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Stop ({batchProgress.current}/{batchProgress.total})</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} />
                      <span>Alle fehlenden laden ({Math.min(missingVideos.length, 20)})</span>
                    </>
                  )}
                </button>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Suchen..." 
                  className="bg-black/60 border border-gray-700 rounded-full py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-netflix-red w-36 sm:w-44"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredMissing.map(video => (
              <div key={video.videoId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors group">
                <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                  <img src={video.thumbnail} className="h-10 w-16 object-cover rounded shadow shrink-0" alt="" referrerPolicy="no-referrer" />
                  <div className="overflow-hidden min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{cleanTitle(video.title)}</p>
                    <p className="text-[10px] font-mono text-gray-500 truncate">{video.videoId}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => handleSyncSingle(video)}
                    disabled={syncingId === video.videoId || isBatchSyncing}
                    className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                    title="Filminformationen jetzt per KI abrufen und in Datenbank speichern"
                  >
                    {syncingId === video.videoId ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span className="hidden sm:inline">Lädt...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} />
                        <span className="hidden sm:inline">Info laden</span>
                      </>
                    )}
                  </button>
                  <a 
                    href={`https://www.youtube.com/watch?v=${video.videoId}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-500 hover:text-white transition-colors"
                    title="Auf YouTube ansehen"
                  >
                    <ExternalLink size={15} />
                  </a>
                </div>
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
          <strong>Tipp:</strong> Klicke direkt auf <strong>„Info laden“</strong> neben einem Film oder oben auf <strong>„Alle fehlenden laden“</strong>, um die Daten per KI in Firestore zu speichern. 
          Sobald die Filminformationen gespeichert sind, verschwindet der Film sofort automatisch aus dieser Liste.
        </p>
      </div>
    </div>
  );
}
