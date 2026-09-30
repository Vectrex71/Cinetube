/**
 * Screen Wake Lock Service
 * Prevents mobile and tablet screens from dimming or sleeping
 * while the app is active or a movie is playing.
 */

let wakeLockSentinel: any = null;
let isRequested = true; // By default, keep screen awake while app is active
let fallbackVideo: HTMLVideoElement | null = null;
let isInitialized = false;

/**
 * Checks if the Screen Wake Lock API is supported in this browser.
 */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

/**
 * Attempts to acquire a screen wake lock.
 */
export async function requestWakeLock(): Promise<boolean> {
  isRequested = true;

  if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
    return false;
  }

  // 1. Try modern Screen Wake Lock API
  if (isWakeLockSupported()) {
    try {
      if (!wakeLockSentinel || wakeLockSentinel.released) {
        // @ts-ignore
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        
        wakeLockSentinel.addEventListener('release', () => {
          // If released by OS or visibility change, wakeLockSentinel is released
        });
      }
      return true;
    } catch (err: any) {
      // Common reasons: User activation required or low power mode
      console.warn('Wake Lock request:', err?.name || err?.message || err);
    }
  }

  // 2. Fallback for iOS / older tablets where wakeLock is unavailable or denied
  startFallbackVideo();
  return false;
}

/**
 * Releases the active wake lock.
 */
export async function releaseWakeLock(): Promise<void> {
  isRequested = false;

  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (e) {
      // Ignore release error
    }
    wakeLockSentinel = null;
  }

  stopFallbackVideo();
}

/**
 * Fallback mechanism for browsers without WakeLock support:
 * An invisible 1px silent looping canvas video that prevents screen sleep.
 */
function startFallbackVideo() {
  if (typeof document === 'undefined') return;
  try {
    if (fallbackVideo && !fallbackVideo.paused) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 1, 1);
    }

    // @ts-ignore
    const captureStream = canvas.captureStream || canvas.mozCaptureStream;
    if (captureStream) {
      const stream = captureStream.call(canvas, 1);
      if (!fallbackVideo) {
        fallbackVideo = document.createElement('video');
        fallbackVideo.setAttribute('playsinline', '');
        fallbackVideo.setAttribute('webkit-playsinline', '');
        fallbackVideo.muted = true;
        fallbackVideo.loop = true;
        fallbackVideo.style.position = 'fixed';
        fallbackVideo.style.top = '-100px';
        fallbackVideo.style.left = '-100px';
        fallbackVideo.style.width = '1px';
        fallbackVideo.style.height = '1px';
        fallbackVideo.style.opacity = '0';
        fallbackVideo.style.pointerEvents = 'none';
        document.body.appendChild(fallbackVideo);
      }
      fallbackVideo.srcObject = stream;
      fallbackVideo.play().catch(() => {});
    }
  } catch (e) {
    // Ignore fallback failure
  }
}

function stopFallbackVideo() {
  if (fallbackVideo) {
    try {
      fallbackVideo.pause();
      if (fallbackVideo.srcObject) {
        const stream = fallbackVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        fallbackVideo.srcObject = null;
      }
      fallbackVideo.remove();
    } catch (e) {}
    fallbackVideo = null;
  }
}

/**
 * Initialize automatic wake lock management:
 * - Re-acquires on user touch/click (resolves browser user-gesture restrictions)
 * - Re-acquires when returning from another tab or unlocking device
 * - Periodically verifies lock status while active
 */
export function initWakeLock(): () => void {
  if (typeof window === 'undefined' || isInitialized) {
    return () => {};
  }
  isInitialized = true;

  // Immediate attempt
  requestWakeLock();

  // Re-acquire on user interactions (required on mobile before permission granted)
  const handleUserActivity = () => {
    if (isRequested && (!wakeLockSentinel || wakeLockSentinel.released)) {
      requestWakeLock();
    }
  };

  window.addEventListener('touchstart', handleUserActivity, { passive: true });
  window.addEventListener('pointerdown', handleUserActivity, { passive: true });
  window.addEventListener('click', handleUserActivity, { passive: true });
  window.addEventListener('keydown', handleUserActivity, { passive: true });

  // Re-acquire on visibilitychange (browser releases wake lock when tab is backgrounded)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isRequested) {
      requestWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Periodic safety check every 30s
  const intervalId = setInterval(() => {
    if (document.visibilityState === 'visible' && isRequested) {
      if (!wakeLockSentinel || wakeLockSentinel.released) {
        requestWakeLock();
      }
    }
  }, 30000);

  return () => {
    window.removeEventListener('touchstart', handleUserActivity);
    window.removeEventListener('pointerdown', handleUserActivity);
    window.removeEventListener('click', handleUserActivity);
    window.removeEventListener('keydown', handleUserActivity);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    clearInterval(intervalId);
    isInitialized = false;
  };
}
