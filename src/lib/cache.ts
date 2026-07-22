/**
 * In-Memory & LocalStorage Performance Caching Utility
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export const AppCache = {
  get<T>(key: string): T | null {
    // 1. Check memory cache first (fastest, < 1ms)
    const memEntry = memoryCache.get(key);
    if (memEntry) {
      if (Date.now() - memEntry.timestamp < memEntry.ttl) {
        return memEntry.data as T;
      }
      memoryCache.delete(key);
    }

    // 2. Fallback to localStorage
    try {
      const raw = localStorage.getItem(`aic_cache_${key}`);
      if (raw) {
        const parsed: CacheEntry<T> = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < parsed.ttl) {
          // Re-populate memory cache
          memoryCache.set(key, parsed);
          return parsed.data;
        }
        localStorage.removeItem(`aic_cache_${key}`);
      }
    } catch (_) {
      // Ignore storage errors
    }

    return null;
  },

  set<T>(key: string, data: T, ttlMs: number = 300000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs,
    };

    memoryCache.set(key, entry);

    try {
      localStorage.setItem(`aic_cache_${key}`, JSON.stringify(entry));
    } catch (_) {
      // Ignore quota errors
    }
  },

  invalidate(key: string): void {
    memoryCache.delete(key);
    try {
      localStorage.removeItem(`aic_cache_${key}`);
    } catch (_) {}
  },

  clear(): void {
    memoryCache.clear();
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('aic_cache_')) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}
  },
};
