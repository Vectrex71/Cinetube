import React, { useMemo, useState, useEffect, useRef } from 'react';
import { YouTubeVideo } from '../types';
import { getDbInstance, collection, onSnapshot, query, doc, deleteDoc } from '../firebase';
import { Trash2, Search, ExternalLink, Loader2, AlertCircle, RefreshCw, Sparkles, CheckCircle2, RotateCcw, ShieldAlert, Film, Copy } from 'lucide-react';
import { cn, cleanTitle } from '../lib/utils';
import { fetchMovieInfo } from '../services/movieInfo';

interface DifferenceViewProps {
  videos: YouTubeVideo[];
  onClose: () => void;
  onRefresh?: () => Promise<void>;
}

export function DifferenceView({ videos, onClose, onRefresh }: DifferenceViewProps) {
  const [cachedIds, setCachedIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [isBatchRestoring, setIsBatchRestoring] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'blocked' | 'missing' | 'duplicates'>('blocked');
  const abortControllerRef = useRef<AbortController | null>(null);
  const db = getDbInstance();

  // Listen to movieDetails
  useEffect(() => {
    const q = query(collection(db, 'movieDetails'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setCachedIds(ids);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching movieDetails IDs:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  // Listen to deletedVideos
  useEffect(() => {
    const q = query(collection(db, 'deletedVideos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setDeletedIds(ids);
    }, (err) => {
      console.error("Error fetching deletedVideos IDs:", err);
    });
    return () => unsubscribe();
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

  // Restore a video from deletedVideos
  const handleRestoreDeleted = async (videoId: string, title?: string) => {
    if (restoringId || isBatchRestoring) return;
    setRestoringId(videoId);
    setSyncFeedback(null);
    try {
      await deleteDoc(doc(db, 'deletedVideos', videoId));
      await deleteDoc(doc(db, 'hiddenVideos', videoId)).catch(() => {});
      setSyncFeedback(`"${title ? cleanTitle(title) : videoId}" erfolgreich wiederhergestellt!`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      console.error("Error restoring video:", err);
      alert(`Fehler beim Wiederherstellen von "${title || videoId}": ${err?.message || 'Unbekannter Fehler'}`);
    } finally {
      setRestoringId(null);
    }
  };

  // Restore all blocked playlist videos
  const handleRestoreAllBlocked = async () => {
    if (isBatchRestoring || blockedVideos.length === 0) return;
    const count = blockedVideos.length;
    const confirmRestore = window.confirm(
      `Möchtest du alle ${count} Filme (u. a. "15 Killings"), die sich in deiner Playlist befinden aber als gelöscht markiert sind, wiederherstellen?`
    );
    if (!confirmRestore) return;

    setIsBatchRestoring(true);
    setBatchProgress({ current: 0, total: count });
    setSyncFeedback(null);

    let successCount = 0;
    try {
      for (let i = 0; i < blockedVideos.length; i++) {
        const video = blockedVideos[i];
        setBatchProgress({ current: i + 1, total: count });
        try {
          await deleteDoc(doc(db, 'deletedVideos', video.videoId));
          await deleteDoc(doc(db, 'hiddenVideos', video.videoId)).catch(() => {});
          successCount++;
        } catch (err) {
          console.warn("Failed to restore doc:", video.videoId, err);
        }
      }
      setSyncFeedback(`${successCount} Filme erfolgreich wiederhergestellt! Sie sind jetzt wieder in CineTube sichtbar.`);
      setTimeout(() => setSyncFeedback(null), 6000);
    } catch (err: any) {
      console.error("Error during batch restore:", err);
    } finally {
      setIsBatchRestoring(false);
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

  // Blocked playlist videos: in playlist, but in deletedVideos!
  const blockedVideos = useMemo(() => {
    return videos.filter(v => deletedIds.has(v.videoId));
  }, [videos, deletedIds]);

  const missingVideos = useMemo(() => {
    return videos.filter(v => !cachedIds.has(v.videoId) && !deletedIds.has(v.videoId));
  }, [videos, cachedIds, deletedIds]);

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

  // Filter based on active tab and search query
  const filteredBlocked = useMemo(() => {
    if (!searchQuery.trim()) return blockedVideos;
    const q = searchQuery.toLowerCase();
    return blockedVideos.filter(v => 
      v.title.toLowerCase().includes(q) || 
      v.videoId.toLowerCase().includes(q)
    );
  }, [blockedVideos, searchQuery]);

  const filteredMissing = useMemo(() => {
    if (!searchQuery.trim()) return missingVideos;
    const q = searchQuery.toLowerCase();
    return missingVideos.filter(v => 
      v.title.toLowerCase().includes(q) || 
      v.videoId.toLowerCase().includes(q)
    );
  }, [missingVideos, searchQuery]);

  // Automatically select the blocked tab if there are blocked videos and it's the initial load
  useEffect(() => {
    if (blockedVideos.length > 0 && activeTab === 'missing') {
      setActiveTab('blocked');
    }
  }, [blockedVideos.length]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-netflix-red" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center space-x-3">
            <h2 className="text-2xl font-bold text-white">Datenbank & Playlist Abgleich</h2>
            <span className="text-xs bg-red-600/30 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full font-semibold">
              Admin Werkzeuge
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Verwalte die Synchronisierung zwischen deiner YouTube-Playlist ({videos.length} Videos) und Firestore.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs sm:text-sm transition-all hover:bg-white/10 text-white",
              refreshing && "opacity-50 cursor-not-allowed"
            )}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span>{refreshing ? 'Aktualisiere...' : 'Playlist neu laden'}</span>
          </button>
          <button 
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs sm:text-sm text-gray-200 hover:text-white transition-colors"
          >
            Zurück zur Startseite
          </button>
        </div>
      </div>

      {syncFeedback && (
        <div className="flex items-center space-x-2 text-sm text-green-300 bg-green-950/70 p-3.5 rounded-lg border border-green-600/50 shadow-lg animate-in fade-in">
          <CheckCircle2 size={18} className="text-green-400 shrink-0" />
          <span className="font-medium">{syncFeedback}</span>
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2 p-1 bg-black/50 border border-gray-800 rounded-xl">
          <button
            onClick={() => setActiveTab('blocked')}
            className={cn(
              "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'blocked'
                ? "bg-red-600 text-white shadow-md"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <ShieldAlert size={16} />
            <span>Gelöschte Filme</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[11px] font-mono",
              activeTab === 'blocked' ? "bg-black/30 text-white" : "bg-red-950 text-red-300 border border-red-800"
            )}>
              {blockedVideos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('missing')}
            className={cn(
              "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'missing'
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Film size={16} />
            <span>Nicht in Datenbank</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[11px] font-mono",
              activeTab === 'missing' ? "bg-black/30 text-white" : "bg-blue-950 text-blue-300 border border-blue-800"
            )}>
              {missingVideos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('duplicates')}
            className={cn(
              "flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all",
              activeTab === 'duplicates'
                ? "bg-yellow-600 text-white shadow-md"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            )}
          >
            <Copy size={16} />
            <span>Mögliche Duplikate</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[11px] font-mono",
              activeTab === 'duplicates' ? "bg-black/30 text-white" : "bg-yellow-950 text-yellow-300 border border-yellow-800"
            )}>
              {duplicateTitles.length}
            </span>
          </button>
        </div>

        {/* Global Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input 
            type="text" 
            placeholder="In Liste suchen (Titel / ID)..." 
            className="bg-black/60 border border-gray-700 rounded-full py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-netflix-red w-48 sm:w-64 text-white placeholder:text-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tab 1: Blocked / Deleted Playlist Videos */}
      {activeTab === 'blocked' && (
        <section className="space-y-4 rounded-xl bg-black/40 p-6 border border-red-950/60 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-red-950/30 p-4 rounded-lg border border-red-900/40">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="text-red-400 shrink-0" size={20} />
                <h3 className="text-lg font-bold text-white">
                  In YouTube-Playlist, aber in CineTube als „Gelöscht“ blockiert ({blockedVideos.length})
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-gray-300 max-w-3xl">
                Hier liegt die Ursache für fehlende Filme wie <strong>„15 Killings“</strong>! Diese Filme befinden sich in deiner aktuellen Playlist, 
                wurden aber in der Vergangenheit als „Endgültig gelöscht“ markiert. Klicke auf <strong>„Wiederherstellen“</strong>, 
                um sie sofort wieder auf der Startseite und in allen Listen einzublenden.
              </p>
            </div>
            {blockedVideos.length > 0 && (
              <button
                onClick={handleRestoreAllBlocked}
                disabled={isBatchRestoring}
                className={cn(
                  "flex items-center space-x-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-bold shadow-lg transition-all shrink-0",
                  isBatchRestoring
                    ? "bg-yellow-600/30 text-yellow-300 border border-yellow-500/50 cursor-wait"
                    : "bg-green-600 hover:bg-green-700 text-white"
                )}
              >
                {isBatchRestoring ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Wiederherstellen ({batchProgress.current}/{batchProgress.total})...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    <span>Alle {blockedVideos.length} Filme wiederherstellen</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {filteredBlocked.map(video => {
              const hasDetails = cachedIds.has(video.videoId);
              return (
                <div key={video.videoId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-red-900/30 transition-colors group">
                  <div className="flex items-center space-x-3 overflow-hidden min-w-0 pr-2">
                    <img src={video.thumbnail} className="h-10 w-16 object-cover rounded shadow shrink-0" alt="" referrerPolicy="no-referrer" />
                    <div className="overflow-hidden min-w-0">
                      <div className="flex items-center space-x-2 truncate">
                        <p className="text-sm font-medium text-gray-200 truncate">{cleanTitle(video.title)}</p>
                        {hasDetails ? (
                          <span className="text-[10px] bg-green-950/80 text-green-400 border border-green-800/60 px-1.5 py-0.2 rounded shrink-0">
                            Filmdaten OK
                          </span>
                        ) : (
                          <span className="text-[10px] bg-yellow-950/80 text-yellow-400 border border-yellow-800/60 px-1.5 py-0.2 rounded shrink-0">
                            Keine Filmdaten
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] font-mono text-gray-500 truncate">{video.videoId}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => handleRestoreDeleted(video.videoId, video.title)}
                      disabled={restoringId === video.videoId || isBatchRestoring}
                      className="flex items-center space-x-1.5 px-3 py-1.5 text-xs rounded-md bg-green-600/20 text-green-400 border border-green-600/40 hover:bg-green-600 hover:text-white transition-all disabled:opacity-50 font-medium"
                      title="Aus 'deletedVideos' entfernen und in CineTube wieder anzeigen"
                    >
                      {restoringId === video.videoId ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Wiederherstellen...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw size={13} />
                          <span>Wiederherstellen</span>
                        </>
                      )}
                    </button>
                    {!hasDetails && (
                      <button
                        onClick={() => handleSyncSingle(video)}
                        disabled={syncingId === video.videoId || isBatchSyncing}
                        className="flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
                        title="Filmdaten per KI abrufen"
                      >
                        {syncingId === video.videoId ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        <span className="hidden sm:inline">Info laden</span>
                      </button>
                    )}
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
              );
            })}
            {filteredBlocked.length === 0 && (
              <div className="text-center py-12 text-gray-400 space-y-2">
                <CheckCircle2 size={32} className="mx-auto text-green-500 opacity-80" />
                <p className="font-medium text-white">Keine blockierten Playlist-Filme!</p>
                <p className="text-xs text-gray-500">Alle Filme aus deiner YouTube-Playlist sind in CineTube aktiv und nicht in der Ausschlussliste.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 2: Missing in Database Section */}
      {activeTab === 'missing' && (
        <section className="space-y-4 rounded-xl bg-black/40 p-6 border border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-netflix-red">Nicht in Datenbank ({missingVideos.length})</h3>
              <p className="text-sm text-gray-400">Diese YouTube-Videos haben noch keine detaillierten Filmdaten in Firestore.</p>
            </div>
            <div>
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
      )}

      {/* Tab 3: Possible Duplicates Section */}
      {activeTab === 'duplicates' && (
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
      )}
      
      <div className="flex items-center space-x-2 text-sm text-gray-400 bg-netflix-red/10 p-4 rounded-lg border border-netflix-red/20">
        <AlertCircle size={18} className="text-netflix-red shrink-0" />
        <p>
          <strong>Tipp:</strong> Wenn ein Film auf YouTube in der Playlist ist, aber in CineTube fehlt (wie <em>„15 Killings“</em>), 
          findest du ihn oben im Reiter <strong>„Gelöschte Filme“</strong> und kannst ihn mit einem Klick auf <strong>„Wiederherstellen“</strong> oder 
          <strong>„Alle wiederherstellen“</strong> sofort reaktivieren.
        </p>
      </div>
    </div>
  );
}
