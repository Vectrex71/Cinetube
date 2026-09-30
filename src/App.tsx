import { useEffect, useState, useMemo, useRef } from 'react';
import { YouTubeVideo } from './types';
import { fetchPlaylistItems } from './services/youtube';
import { Hero } from './components/Hero';
import { MovieRow } from './components/MovieRow';
import { PlayerModal } from './components/PlayerModal';
import { MovieInfoModal } from './components/MovieInfoModal';
import { LoginWall } from './components/LoginWall';
import { Search, Bell, User, Loader2, AlertCircle, LogIn, LogOut, EyeOff, Trash2, RotateCcw, Plus, Bookmark, Info, Trophy, RefreshCw, Maximize, Minimize } from 'lucide-react';
import { cn } from './lib/utils';
import { getAuthInstance, getDbInstance, signIn, logOut, collection, onSnapshot, query, doc, setDoc, deleteDoc, serverTimestamp, updateDoc, orderBy, limit, getDoc, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { fetchMovieInfo } from './services/movieInfo';
import { DifferenceView } from './components/DifferenceView';
import { Thumbnail } from './components/Thumbnail';
import { initWakeLock } from './services/wakeLock';

const PLAYLIST_ID = 'PLVE-5VXia_avG4pdsM0AEjXbq8D9FiebW';
const ADMIN_EMAIL = 'hj.wuethrich@gmail.com';

export default function App() {
  const auth = getAuthInstance();
  const db = getDbInstance();
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [myListIds, setMyListIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [infoVideo, setInfoVideo] = useState<YouTubeVideo | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [adminModeActive, setAdminModeActive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [allMovieDetails, setAllMovieDetails] = useState<Map<string, any>>(new Map());
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [view, setView] = useState<'home' | 'all-movies' | 'trash' | 'my-list' | 'difference'>('home');
  const [sortBy, setSortBy] = useState<'added' | 'alphabetical'>('added');
  const [recommendedVideos, setRecommendedVideos] = useState<YouTubeVideo[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<Set<string>>(new Set());
  const [isDbLoaded, setIsDbLoaded] = useState({
    hidden: false,
    deleted: false,
    details: false,
    recommended: false,
    myList: false,
  });
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const isAllDbLoaded = useMemo(() => {
    return isDbLoaded.hidden && 
           isDbLoaded.deleted && 
           isDbLoaded.details && 
           isDbLoaded.recommended && 
           (user ? isDbLoaded.myList : true);
  }, [isDbLoaded, user]);

  useEffect(() => {
    if (!loading && isAllDbLoaded) {
      setIsInitialLoad(false);
    }
  }, [loading, isAllDbLoaded]);
  const [randomFeaturedMovie, setRandomFeaturedMovie] = useState<YouTubeVideo | null>(null);
  const [popularVideos, setPopularVideos] = useState<YouTubeVideo[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [featuredVideos, setFeaturedVideos] = useState<YouTubeVideo[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const newReleasesRef = useRef<HTMLDivElement>(null);
  const popularRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isAdmin = useMemo(() => user?.email === ADMIN_EMAIL, [user]);

  // Keep screen awake (prevent tablet from dimming/sleeping after 2 minutes)
  useEffect(() => {
    const cleanupWakeLock = initWakeLock();
    return () => cleanupWakeLock();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const visibleVideos = useMemo(() => {
    return videos.filter(v => !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
  }, [videos, hiddenIds, deletedIds]);

  const trashVideos = useMemo(() => {
    return videos.filter(v => hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
  }, [videos, hiddenIds, deletedIds]);

  const myListVideos = useMemo(() => {
    return videos.filter(v => myListIds.has(v.videoId) && !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
  }, [videos, myListIds, hiddenIds, deletedIds]);

  const bestRecommendations = useMemo(() => {
    const filtered = videos.filter(v => recommendedIds.has(v.videoId) && !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
    return [...filtered].sort(() => 0.5 - Math.random());
  }, [videos, recommendedIds, hiddenIds, deletedIds]);

  const alphabeticalVideos = useMemo(() => {
    return [...visibleVideos].sort((a, b) => a.title.localeCompare(b.title));
  }, [visibleVideos]);

  const filteredVideos = useMemo(() => {
    const queryStr = searchQuery.trim().toLowerCase();
    const source = view === 'trash' ? trashVideos : view === 'my-list' ? myListVideos : visibleVideos;
    
    let result = [...source];

    // Filter by genre
    if (selectedGenre) {
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

      result = result.filter(video => {
        const details = allMovieDetails.get(video.videoId);
        if (!details || !Array.isArray(details.genres)) return false;
        
        return details.genres.some((g: string) => {
          const lowerG = g.toLowerCase().trim();
          const normalized = mapping[lowerG] || g;
          return normalized === selectedGenre;
        });
      });
    }

    // Filter by search query
    if (queryStr) {
      result = result.filter(video => {
        const title = video.title.toLowerCase();
        const description = video.description.toLowerCase();
        const details = allMovieDetails.get(video.videoId);
        
        // Match in basic metadata
        if (title.includes(queryStr)) return true;
        
        // Match in AI details
        if (details) {
          if (details.title?.toLowerCase().includes(queryStr)) return true;
          if (details.customSearchTitle?.toLowerCase().includes(queryStr)) return true;
          if (details.director?.toLowerCase().includes(queryStr)) return true;
          if (details.cast?.some((c: string) => c.toLowerCase().includes(queryStr))) return true;
          if (details.genres?.some((g: string) => g.toLowerCase().includes(queryStr))) return true;
          if (details.overview?.toLowerCase().includes(queryStr)) return true;
        }

        const wordBoundaryRegex = new RegExp(`\\b${queryStr}`, 'i');
        return wordBoundaryRegex.test(description);
      });
    }

    // Apply sorting
    if (sortBy === 'alphabetical') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    // 'added' is the default order from the source array

    return result;
  }, [visibleVideos, trashVideos, searchQuery, selectedGenre, allMovieDetails, view, sortBy]);

  useEffect(() => {
    if (visibleVideos.length > 0 && featuredVideos.length === 0) {
      const shuffled = [...visibleVideos].sort(() => 0.5 - Math.random());
      setRecommendedVideos(shuffled.slice(0, 15));
      setFeaturedVideos(shuffled.slice(0, 10)); // Top 10 for rotation
      setRandomFeaturedMovie(shuffled[0]);
    }
  }, [visibleVideos, featuredVideos.length]);

  // Auto-rotate hero every 10 seconds
  useEffect(() => {
    if (featuredVideos.length <= 1) return;

    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % featuredVideos.length);
    }, 10000);

    return () => clearInterval(interval);
  }, [featuredVideos]);

  // Sync featured and recommended videos with visibility changes (remove hidden/deleted)
  useEffect(() => {
    if (featuredVideos.length > 0) {
      const stillVisibleFeatured = featuredVideos.filter(v => !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
      if (stillVisibleFeatured.length !== featuredVideos.length) {
        setFeaturedVideos(stillVisibleFeatured);
      }
    }
    
    if (recommendedVideos.length > 0) {
      const stillVisibleRecommended = recommendedVideos.filter(v => !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId));
      if (stillVisibleRecommended.length !== recommendedVideos.length) {
        setRecommendedVideos(stillVisibleRecommended);
      }
    }
  }, [hiddenIds, deletedIds]);

  // Listen to popular videos from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'videoStats'),
      orderBy('viewCount', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const statsMap = new Map<string, number>();
      snapshot.forEach((doc) => {
        statsMap.set(doc.id, doc.data().viewCount);
      });
      
      // Map stats back to video objects
      const popular = videos
        .filter(v => statsMap.has(v.videoId) && !hiddenIds.has(v.videoId) && !deletedIds.has(v.videoId))
        .sort((a, b) => (statsMap.get(b.videoId) || 0) - (statsMap.get(a.videoId) || 0));
      
      setPopularVideos(popular);
    });
    
    return () => unsubscribe();
  }, [videos, hiddenIds, deletedIds]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Listen to hidden videos from Firestore
  useEffect(() => {
    const q = query(collection(db, 'hiddenVideos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setHiddenIds(ids);
      setIsDbLoaded(prev => ({ ...prev, hidden: true }));
    }, (err) => {
      console.error("Firestore error:", err);
      setIsDbLoaded(prev => ({ ...prev, hidden: true }));
    });
    return () => unsubscribe();
  }, []);

  // Listen to deleted videos from Firestore
  useEffect(() => {
    const q = query(collection(db, 'deletedVideos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setDeletedIds(ids);
      setIsDbLoaded(prev => ({ ...prev, deleted: true }));
    }, (err) => {
      console.error("Firestore error (deleted):", err);
      setIsDbLoaded(prev => ({ ...prev, deleted: true }));
    });
    return () => unsubscribe();
  }, []);

  // Listen to all movie details from Firestore to extract genres
  useEffect(() => {
    const q = query(collection(db, 'movieDetails'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const detailsMap = new Map<string, any>();
      snapshot.forEach((doc) => {
        detailsMap.set(doc.id, doc.data());
      });
      setAllMovieDetails(detailsMap);
      setIsDbLoaded(prev => ({ ...prev, details: true }));
    }, (err) => {
      console.error("Error fetching all movie details:", err);
      setIsDbLoaded(prev => ({ ...prev, details: true }));
    });
    return () => unsubscribe();
  }, [db]);

  const allGenres = useMemo(() => {
    const genres = new Set<string>();
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

    allMovieDetails.forEach((details) => {
      if (Array.isArray(details.genres)) {
        details.genres.forEach((g: string) => {
          if (g && g !== 'N/A') {
            const lowerG = g.toLowerCase().trim();
            const normalized = mapping[lowerG] || g;
            const lowerNormalized = normalized.toLowerCase().trim();
            
            if (!excludedGenres.includes(lowerNormalized)) {
              genres.add(normalized);
            }
          }
        });
      }
    });
    return Array.from(genres).sort();
  }, [allMovieDetails]);

  // Listen to My List from Firestore
  useEffect(() => {
    if (!user) {
      setMyListIds(new Set());
      setIsDbLoaded(prev => ({ ...prev, myList: true }));
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'myList'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setMyListIds(ids);
      setIsDbLoaded(prev => ({ ...prev, myList: true }));
    }, (err) => {
      console.error("My List error:", err);
      setIsDbLoaded(prev => ({ ...prev, myList: true }));
    });
    return () => unsubscribe();
  }, [user]);

  // Listen to global recommendations from Firestore
  useEffect(() => {
    const q = query(collection(db, 'recommendedVideos'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.id);
      });
      setRecommendedIds(ids);
      setIsDbLoaded(prev => ({ ...prev, recommended: true }));
    }, (err) => {
      console.error("Recommendations error:", err);
      setIsDbLoaded(prev => ({ ...prev, recommended: true }));
    });
    return () => unsubscribe();
  }, []);

  const fetchVideos = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const data = await fetchPlaylistItems(PLAYLIST_ID, forceRefresh);
      setVideos(data.items);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Fehler beim Laden der Playlist');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleHideVideo = async (videoId: string) => {
    console.log("Hiding video:", videoId);
    if (!isAdmin || !user) {
      console.warn("Hide failed: Not admin or not logged in");
      return;
    }
    
    try {
      await setDoc(doc(db, 'hiddenVideos', videoId), {
        videoId,
        hiddenBy: user.email,
        hiddenAt: new Date()
      });
      console.log("Video hidden successfully");
    } catch (err) {
      console.error("Error hiding video:", err);
    }
  };

  const handleVideoPlay = async (video: YouTubeVideo) => {
    if (!user) return; // Only track for logged-in users (family)
    
    try {
      const statsRef = doc(db, 'videoStats', video.videoId);
      const statsDoc = await getDoc(statsRef);
      
      if (statsDoc.exists()) {
        await updateDoc(statsRef, {
          viewCount: (statsDoc.data().viewCount || 0) + 1,
          lastViewedAt: serverTimestamp()
        });
      } else {
        await setDoc(statsRef, {
          videoId: video.videoId,
          viewCount: 1,
          lastViewedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error updating video stats:", err);
    }
  };

  const handleRestoreVideo = async (videoId: string) => {
    console.log("Restoring video:", videoId);
    if (!isAdmin || !user) {
      console.warn("Restore failed: Not admin or not logged in");
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'hiddenVideos', videoId));
      console.log("Video restored successfully");
    } catch (err) {
      console.error("Error restoring video:", err);
    }
  };

  const handleToggleMyList = async (videoId: string) => {
    if (!user) {
      alert("Bitte melde dich an, um Videos zu deiner Liste hinzuzufügen.");
      return;
    }
    
    const isAdded = myListIds.has(videoId);
    try {
      if (isAdded) {
        await deleteDoc(doc(db, 'users', user.uid, 'myList', videoId));
      } else {
        await setDoc(doc(db, 'users', user.uid, 'myList', videoId), {
          videoId,
          userId: user.uid,
          addedAt: new Date()
        });
      }
    } catch (err) {
      console.error("Error toggling My List:", err);
    }
  };

  const handleToggleRecommendation = async (videoId: string) => {
    if (!isAdmin || !user) return;
    
    const isRecommended = recommendedIds.has(videoId);
    try {
      if (isRecommended) {
        await deleteDoc(doc(db, 'recommendedVideos', videoId));
      } else {
        await setDoc(doc(db, 'recommendedVideos', videoId), {
          videoId,
          addedBy: user.email,
          addedAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error toggling recommendation:", err);
    }
  };

  const handleDeletePermanently = async (videoId: string) => {
    console.log("Deleting video permanently:", videoId);
    if (!isAdmin || !user) {
      console.warn("Delete failed: Not admin or not logged in");
      return;
    }
    
    try {
      // Add to deletedVideos
      await setDoc(doc(db, 'deletedVideos', videoId), {
        videoId,
        deletedBy: user.email,
        deletedAt: new Date()
      });
      // Remove from hiddenVideos
      await deleteDoc(doc(db, 'hiddenVideos', videoId));
      console.log("Video deleted permanently successfully");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'deletedVideos/' + videoId);
      console.error("Error deleting video permanently:", err);
    }
  };

  const handleEmptyTrash = async () => {
    if (!isAdmin || !user || trashVideos.length === 0) return;
    
    try {
      setLoading(true);
      for (const video of trashVideos) {
        await setDoc(doc(db, 'deletedVideos', video.videoId), {
          videoId: video.videoId,
          deletedBy: user.email,
          deletedAt: new Date()
        });
        await deleteDoc(doc(db, 'hiddenVideos', video.videoId));
      }
    } catch (err) {
      console.error("Error emptying trash:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAllMovieDetails = async () => {
    if (!isAdmin || !user || isSyncing) return;
    
    setLoading(true);
    const videosToUpdate: YouTubeVideo[] = [];
    
    try {
      // 1. Identify which videos actually need info
      for (const video of visibleVideos) {
        const cacheRef = doc(db, 'movieDetails', video.videoId);
        const cacheSnap = await getDoc(cacheRef);
        if (!cacheSnap.exists()) {
          videosToUpdate.push(video);
        }
      }
    } catch (err) {
      console.error("Error checking cache status:", err);
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }

    if (videosToUpdate.length === 0) {
      alert("Alle sichtbaren Filme haben bereits gespeicherte Informationen.");
      return;
    }

    const confirmSync = window.confirm(
      `Es wurden ${videosToUpdate.length} Filme ohne Infos gefunden.\n\nMöchtest du die Filminfos für diese Filme jetzt laden?\n(Limit: 20 Filme pro Durchgang um Kosten zu sparen)`
    );
    
    if (!confirmSync) return;

    abortControllerRef.current = new AbortController();
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: Math.min(videosToUpdate.length, 20) });

    try {
      let count = 0;
      const batchSize = Math.min(videosToUpdate.length, 20);

      for (let i = 0; i < batchSize; i++) {
        if (abortControllerRef.current.signal.aborted) break;

        const video = videosToUpdate[i];
        setSyncProgress({ current: i + 1, total: batchSize });
        
        // Fetch and cache
        try {
          await fetchMovieInfo(video.title, video.videoId);
          count++;
        } catch (err: any) {
          const errMsg = err?.message?.toLowerCase() || '';
          if (errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('quota')) {
            console.warn('[MovieInfo] Rate limit hit or quota exceeded, stopping batch for now.');
            break; 
          }
          console.error('[MovieInfo] Batch item error:', err);
        }
        
        // Safety pause between calls - increased to 5s to stay under free tier limits
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      if (!abortControllerRef.current.signal.aborted) {
        alert(`${count} Filme erfolgreich aktualisiert.`);
      }
    } catch (err) {
      console.error("Error syncing movie details:", err);
      alert("Fehler bei der Synchronisierung.");
    } finally {
      setIsSyncing(false);
      abortControllerRef.current = null;
    }
  };

  const cancelSync = () => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
      }
  };

  const refreshAll = async () => {
    await fetchVideos(true);
  };

  const navigateTo = (section: 'home' | 'new' | 'popular' | 'all-movies' | 'trash' | 'my-list' | 'difference') => {
    setSearchQuery('');
    setSelectedGenre(null);
    setIsSearchVisible(false);
    
    if (section === 'home') {
      setView('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'all-movies') {
      setView('all-movies');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'trash') {
      setView('trash');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'my-list') {
      setView('my-list');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'difference') {
      setView('difference');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'new' || section === 'popular') {
      setView('home');
      const targetRef = section === 'new' ? newReleasesRef : popularRef;
      
      // Small delay to ensure we are in home view before scrolling
      setTimeout(() => {
        if (targetRef.current) {
          const offset = 100; // Offset for navbar
          const elementPosition = targetRef.current?.getBoundingClientRect().top || 0;
          const offsetPosition = elementPosition + window.pageYOffset - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-netflix-black">
        <Loader2 className="animate-spin text-netflix-red" size={48} />
        <p className="text-xl font-medium text-gray-400">CineTube wird geladen...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginWall />;
  }

  if (isInitialLoad) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-4 bg-netflix-black">
        <Loader2 className="animate-spin text-netflix-red" size={48} />
        <p className="text-xl font-medium text-gray-400">CineTube wird geladen...</p>
      </div>
    );
  }

  if (error && videos.length === 0) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center space-y-6 bg-netflix-black px-4 text-center">
        <AlertCircle className="text-netflix-red" size={64} />
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Ups! Etwas ist schiefgelaufen</h2>
          <p className="max-w-md text-gray-400">
            {error.includes('API Key') 
              ? 'Bitte füge einen gültigen YouTube API Key in den Einstellungen hinzu (VITE_YOUTUBE_API_KEY).'
              : error}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="rounded bg-white px-8 py-2 font-semibold text-black transition hover:bg-white/80"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  const featuredMovie = featuredVideos[heroIndex] || randomFeaturedMovie || videos[0];

  return (
    <div className="relative min-h-screen bg-netflix-black">
      {/* Navbar */}
      <nav className={`fixed top-0 z-50 flex w-full items-center justify-between px-4 md:px-12 py-3 md:py-4 transition-all duration-300 bg-black/40 backdrop-blur-xl border-b border-white/5`}>
        <div className="flex items-center space-x-4 md:space-x-8">
          <h1 className="text-xl md:text-3xl font-bold tracking-tighter text-netflix-red">CINETUBE</h1>
          <ul className="hidden space-x-4 text-sm font-medium text-gray-200 lg:flex">
            <li onClick={() => navigateTo('home')} className={`cursor-pointer transition hover:text-gray-400 ${view === 'home' && !searchQuery ? 'text-white font-bold' : ''}`}>Startseite</li>
            <li onClick={() => navigateTo('all-movies')} className={`cursor-pointer transition hover:text-gray-400 ${view === 'all-movies' && !searchQuery ? 'text-white font-bold' : ''}`}>Alle</li>
            <li onClick={() => navigateTo('new')} className="cursor-pointer transition hover:text-gray-400">Neuerscheinungen</li>
            <li onClick={() => navigateTo('popular')} className="cursor-pointer transition hover:text-gray-400">Beliebt</li>
            {isAdmin && adminModeActive && (
              <>
                <li onClick={() => navigateTo('trash')} className={`flex items-center space-x-1 cursor-pointer transition hover:text-gray-400 ${view === 'trash' && !searchQuery ? 'text-white font-bold' : ''}`}>
                  <Trash2 size={16} />
                  <span>Papierkorb</span>
                </li>
                <li onClick={() => navigateTo('difference')} className={`flex items-center space-x-1 cursor-pointer transition hover:text-gray-400 ${view === 'difference' && !searchQuery ? 'text-white font-bold' : ''}`}>
                  <RefreshCw size={16} />
                  <span>DB-Check</span>
                </li>
              </>
            )}
            <li onClick={() => navigateTo('my-list')} className={`cursor-pointer transition hover:text-gray-400 ${view === 'my-list' && !searchQuery ? 'text-white font-bold' : ''}`}>Meine Liste</li>
          </ul>
        </div>

        <div className="flex items-center space-x-2 md:space-x-6 text-white flex-1 justify-end">
          <div className={`flex items-center transition-all duration-300 ${isSearchVisible ? 'w-full max-w-[180px] md:max-w-[220px] border border-white bg-black/40 px-2 py-1' : 'w-8'}`}>
            <Search 
              className="cursor-pointer shrink-0" 
              size={20} 
              onClick={() => setIsSearchVisible(!isSearchVisible)}
            />
            {isSearchVisible && (
              <input
                autoFocus
                type="text"
                placeholder="Titel, Personen, Genres"
                className="ml-2 w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            )}
          </div>
          
          {!isSearchVisible && (
            <>
              <button 
                onClick={toggleFullscreen}
                className="hidden cursor-pointer sm:block text-gray-200 hover:text-white transition-colors"
                title={isFullscreen ? "Vollbild beenden" : "Vollbild"}
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
              <Bell className="hidden cursor-pointer sm:block" size={20} />
              
              {user ? (
                <div className="flex items-center space-x-2 md:space-x-4">
                  {isAdmin && (
                    <button 
                      onClick={() => {
                        const newMode = !adminModeActive;
                        setAdminModeActive(newMode);
                        if (!newMode && view === 'trash') {
                          setView('home');
                        }
                      }}
                      className={`flex items-center space-x-1 rounded px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold transition-colors ${
                        adminModeActive ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                      }`}
                    >
                      <span className="hidden sm:inline">ADMIN</span>
                      <div className={`h-2 w-2 rounded-full bg-white ${adminModeActive ? 'animate-pulse' : ''}`} />
                    </button>
                  )}
                  <div className="flex items-center space-x-2">
                    <div className="h-7 w-7 md:h-8 md:w-8 overflow-hidden rounded bg-blue-500">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="User" className="h-full w-full" />
                      ) : (
                        <User className="h-full w-full p-1" />
                      )}
                    </div>
                  </div>
                  <button onClick={logOut} className="text-gray-400 transition hover:text-white">
                    <LogOut className="w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={signIn}
                  className="flex items-center space-x-2 rounded bg-netflix-red px-3 md:px-4 py-1 md:py-1.5 text-xs md:text-sm font-semibold transition hover:bg-red-700"
                >
                  <LogIn className="w-[16px] h-[16px] md:w-[18px] md:h-[18px]" />
                  <span>Login</span>
                </button>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Sticky Category Sub-Header */}
      {!searchQuery && allGenres.length > 0 && (view === 'home' || view === 'all-movies') && (
        <div className="fixed left-0 right-0 top-[60px] md:top-[68px] z-40 bg-black/40 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
          <div className="flex items-center space-x-3 px-4 py-3 md:px-12 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setSelectedGenre(null)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all border",
                !selectedGenre 
                  ? "bg-white text-black border-white shadow-lg" 
                  : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30 hover:text-white hover:bg-white/10"
              )}
            >
              Alle
            </button>
            <div className="h-4 w-[1px] bg-white/10 mx-1 shrink-0" />
            {allGenres.map(genre => (
              <button 
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all border whitespace-nowrap",
                  selectedGenre === genre 
                    ? "bg-white text-black border-white shadow-lg" 
                    : "bg-white/5 text-gray-400 border-white/10 hover:border-white/30 hover:text-white hover:bg-white/10"
                )}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="pb-24 relative z-0">
        {view === 'difference' ? (
          <div className="pt-24 md:pt-32 px-4 md:px-12">
            <DifferenceView 
              videos={videos} 
              onClose={() => setView('home')} 
              onRefresh={refreshAll}
            />
          </div>
        ) : searchQuery || selectedGenre || view === 'all-movies' || view === 'trash' || view === 'my-list' ? (
          <div className="px-4 md:px-12 pt-32 md:pt-40">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-8 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-2 md:space-x-4">
                <h2 className="text-lg md:text-2xl font-semibold text-gray-200">
                  {searchQuery 
                    ? `Ergebnisse für "${searchQuery}"` 
                    : selectedGenre
                      ? `Genre: ${selectedGenre}`
                      : view === 'trash' 
                        ? "Papierkorb (Ausgeblendete Videos)" 
                        : view === 'my-list'
                          ? "Meine Liste"
                          : "Alle Filme"}
                </h2>
                {view === 'trash' && trashVideos.length > 0 && isAdmin && adminModeActive && (
                  <button
                    onClick={handleEmptyTrash}
                    className="flex items-center space-x-1 rounded bg-red-600/20 px-3 py-1 text-xs font-bold text-red-500 transition hover:bg-red-600 hover:text-white"
                  >
                    <Trash2 size={14} />
                    <span>Papierkorb leeren</span>
                  </button>
                )}
                {view === 'all-movies' && isAdmin && adminModeActive && (
                  <button
                    onClick={isSyncing ? cancelSync : handleSyncAllMovieDetails}
                    disabled={false}
                    className={cn(
                      "flex items-center space-x-1 rounded px-3 py-1 text-xs font-bold transition",
                      isSyncing 
                        ? "bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white" 
                        : "bg-blue-600/20 text-blue-500 hover:bg-blue-600 hover:text-white"
                    )}
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Abbrechen ({syncProgress.current}/{syncProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={14} />
                        <span>Alle Filminfos laden</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              
              {view === 'all-movies' && !searchQuery && (
                <div className="flex items-center space-x-4 bg-black/40 border border-gray-700 rounded px-3 py-1.5">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Sortieren:</span>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setSortBy('added')}
                      className={`text-sm px-2 py-0.5 rounded transition ${sortBy === 'added' ? 'bg-white text-black font-bold' : 'text-gray-300 hover:text-white'}`}
                    >
                      Hinzugefügt
                    </button>
                    <button 
                      onClick={() => setSortBy('alphabetical')}
                      className={`text-sm px-2 py-0.5 rounded transition ${sortBy === 'alphabetical' ? 'bg-white text-black font-bold' : 'text-gray-300 hover:text-white'}`}
                    >
                      A-Z
                    </button>
                  </div>
                </div>
              )}
            </div>
            {filteredVideos.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {filteredVideos.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => {
                        setSelectedVideo(video);
                        handleVideoPlay(video);
                      }}
                      className="group relative isolate aspect-video cursor-pointer transition-transform duration-200 ease-out md:hover:scale-105 hover:z-20 z-0"
                    >
                      <div className="relative h-full w-full overflow-hidden rounded-md shadow-md">
                        <Thumbnail
                          videoSrc={video.thumbnail}
                          alt={video.title}
                          loading="lazy"
                        />
                        
                        {/* Action Buttons Overlay */}
                        <div className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2 z-10 flex space-x-1.5 sm:space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInfoVideo(video);
                            }}
                            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-white hover:text-black hover:scale-110 shadow-lg"
                            title="Weitere Infos"
                          >
                            <Info size={15} className="sm:w-[18px] sm:h-[18px]" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMyList(video.videoId);
                            }}
                            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-white hover:text-black hover:scale-110 shadow-lg"
                            title={myListIds.has(video.videoId) ? "Von meiner Liste entfernen" : "Zu meiner Liste hinzufügen"}
                          >
                            {myListIds.has(video.videoId) ? <Bookmark size={15} className="sm:w-[18px] sm:h-[18px] fill-current" /> : <Plus size={15} className="sm:w-[18px] sm:h-[18px]" />}
                          </button>
                        </div>

                        {isAdmin && adminModeActive && (
                          <div className="absolute left-1.5 top-1.5 sm:left-2 sm:top-2 z-10">
                            {view === 'trash' ? (
                              <div className="flex space-x-1.5 sm:space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreVideo(video.videoId);
                                  }}
                                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition duration-200 hover:bg-green-700 hover:scale-110"
                                  title="Video wiederherstellen"
                                >
                                  <RotateCcw size={14} className="sm:w-4 sm:h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePermanently(video.videoId);
                                  }}
                                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition duration-200 hover:bg-red-700 hover:scale-110"
                                  title="Endgültig löschen"
                                >
                                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex space-x-1.5 sm:space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleRecommendation(video.videoId);
                                  }}
                                  className={cn(
                                    "flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-white shadow-lg transition duration-200 hover:scale-110",
                                    recommendedIds.has(video.videoId) ? "bg-yellow-600" : "bg-black/80 hover:bg-yellow-600"
                                  )}
                                  title={recommendedIds.has(video.videoId) ? "Aus Empfehlungen entfernen" : "Zu Empfehlungen hinzufügen"}
                                >
                                  <Trophy size={14} className={cn("sm:w-4 sm:h-4", recommendedIds.has(video.videoId) ? "fill-current" : "")} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHideVideo(video.videoId);
                                  }}
                                  className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/80 text-white shadow-lg transition duration-200 hover:bg-netflix-red hover:scale-110"
                                  title="Video ausblenden"
                                >
                                  <EyeOff size={14} className="sm:w-4 sm:h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                {view === 'trash' ? (
                  <>
                    <Trash2 size={48} className="mb-4 opacity-20" />
                    <p>Der Papierkorb ist leer.</p>
                  </>
                ) : view === 'my-list' ? (
                  <>
                    <Plus size={48} className="mb-4 opacity-20" />
                    <p>Deine Liste ist noch leer. Füge Filme hinzu, um sie hier zu sehen.</p>
                  </>
                ) : (
                  <>
                    <Search size={48} className="mb-4 opacity-20" />
                    <p>Deine Suche ergab leider keine Treffer.</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            {featuredMovie && (
              <Hero 
                video={featuredMovie} 
                onPlay={(v) => {
                  setSelectedVideo(v);
                  handleVideoPlay(v);
                }} 
                onInfo={(v) => setInfoVideo(v)}
              />
            )}

            <div className="mt-8 md:mt-12 relative z-20 pb-8">
              <div ref={newReleasesRef}>
                <MovieRow 
                  title="Neuerscheinungen" 
                  videos={visibleVideos} 
                  onSelect={(v) => {
                    setSelectedVideo(v);
                    handleVideoPlay(v);
                  }} 
                  onInfo={(v) => setInfoVideo(v)}
                  isAdmin={isAdmin && adminModeActive}
                  onHide={handleHideVideo}
                  myListIds={myListIds}
                  onToggleMyList={handleToggleMyList}
                  recommendedIds={recommendedIds}
                  onToggleRecommendation={handleToggleRecommendation}
                />
              </div>

              {bestRecommendations.length > 0 && (
                <MovieRow 
                  title="Die besten CineTube Empfehlungen" 
                  videos={bestRecommendations} 
                  onSelect={(v) => {
                    setSelectedVideo(v);
                    handleVideoPlay(v);
                  }} 
                  onInfo={(v) => setInfoVideo(v)}
                  isAdmin={isAdmin && adminModeActive}
                  onHide={handleHideVideo}
                  myListIds={myListIds}
                  onToggleMyList={handleToggleMyList}
                  recommendedIds={recommendedIds}
                  onToggleRecommendation={handleToggleRecommendation}
                />
              )}

              <MovieRow 
                title="Für Dich ausgewählt" 
                videos={recommendedVideos} 
                onSelect={(v) => {
                  setSelectedVideo(v);
                  handleVideoPlay(v);
                }} 
                onInfo={(v) => setInfoVideo(v)}
                isAdmin={isAdmin && adminModeActive}
                onHide={handleHideVideo}
                myListIds={myListIds}
                onToggleMyList={handleToggleMyList}
                recommendedIds={recommendedIds}
                onToggleRecommendation={handleToggleRecommendation}
              />

              <div ref={popularRef}>
                <MovieRow 
                  title="Beliebt auf CineTube" 
                  videos={popularVideos.length > 0 ? popularVideos : visibleVideos.slice(5, 20)} 
                  onSelect={(v) => {
                    setSelectedVideo(v);
                    handleVideoPlay(v);
                  }} 
                  onInfo={(v) => setInfoVideo(v)}
                  isAdmin={isAdmin && adminModeActive}
                  onHide={handleHideVideo}
                  myListIds={myListIds}
                  onToggleMyList={handleToggleMyList}
                  recommendedIds={recommendedIds}
                  onToggleRecommendation={handleToggleRecommendation}
                />
              </div>

              <MovieRow 
                title="Alle" 
                videos={alphabeticalVideos} 
                onSelect={(v) => {
                  setSelectedVideo(v);
                  handleVideoPlay(v);
                }} 
                onInfo={(v) => setInfoVideo(v)}
                isAdmin={isAdmin && adminModeActive}
                onHide={handleHideVideo}
                onSeeAll={() => navigateTo('all-movies')}
                myListIds={myListIds}
                onToggleMyList={handleToggleMyList}
                recommendedIds={recommendedIds}
                onToggleRecommendation={handleToggleRecommendation}
              />

              {myListVideos.length > 0 && (
                <MovieRow 
                  title="Meine Liste" 
                  videos={myListVideos} 
                  onSelect={(v) => {
                    setSelectedVideo(v);
                    handleVideoPlay(v);
                  }} 
                  onInfo={(v) => setInfoVideo(v)}
                  isAdmin={isAdmin && adminModeActive}
                  onHide={handleHideVideo}
                  onSeeAll={() => navigateTo('my-list')}
                  myListIds={myListIds}
                  onToggleMyList={handleToggleMyList}
                  recommendedIds={recommendedIds}
                  onToggleRecommendation={handleToggleRecommendation}
                />
              )}
            </div>
          </>
        )}
      </main>

      <PlayerModal 
        video={selectedVideo} 
        onClose={() => setSelectedVideo(null)} 
      />

      <MovieInfoModal 
        video={infoVideo} 
        onClose={() => setInfoVideo(null)} 
        isAdmin={isAdmin && adminModeActive}
        onGenreClick={(genre) => {
          setSelectedGenre(genre);
          setInfoVideo(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      <footer className="border-t border-gray-800 px-4 md:px-12 py-8 md:py-12 text-gray-500">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="space-y-2">
            <p className="cursor-pointer hover:underline">Audiobeschreibung</p>
            <p className="cursor-pointer hover:underline">Hilfecenter</p>
            <p className="cursor-pointer hover:underline">Geschenkkarten</p>
          </div>
          <div className="space-y-2">
            <p className="cursor-pointer hover:underline">Medien-Center</p>
            <p className="cursor-pointer hover:underline">Anlegerbeziehungen</p>
            <p className="cursor-pointer hover:underline">Jobs</p>
          </div>
          <div className="space-y-2">
            <p className="cursor-pointer hover:underline">Nutzungsbedingungen</p>
            <p className="cursor-pointer hover:underline">Datenschutz</p>
            <p className="cursor-pointer hover:underline">Rechtliche Hinweise</p>
          </div>
          <div className="space-y-2">
            <p className="cursor-pointer hover:underline">Cookie-Einstellungen</p>
            <p className="cursor-pointer hover:underline">Impressum</p>
            <p className="cursor-pointer hover:underline">Kontakt</p>
          </div>
        </div>
        <div className="mt-8">
          <p className="text-xs">© 2026 CineTube Entertainment - YouTube Playlist Player</p>
        </div>
      </footer>
    </div>
  );
}
