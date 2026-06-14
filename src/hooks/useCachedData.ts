"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

type CachedEnvelope<T> = {
  cachedAt: number;
  expiresAt: number;
  payload: T;
};

type UseCachedDataOptions<T> = {
  cacheKey: string;
  fetcher: () => Promise<T>;
  ttlMs?: number;
  initialData?: T | null;
  revalidateOnMount?: boolean;
};

type UseCachedDataResult<T> = {
  data: T | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const DEFAULT_TTL_MS = 1000 * 60 * 15;

function readCache<T>(cacheKey: string): CachedEnvelope<T> | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CachedEnvelope<T>;
  } catch {
    return null;
  }
}

function writeCache<T>(cacheKey: string, payload: T, ttlMs: number) {
  if (typeof window === "undefined") return;

  const envelope: CachedEnvelope<T> = {
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    payload
  };

  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(envelope));
  } catch {
    // Ignore quota and privacy mode failures. The hook still works in-memory.
  }
}

export function useCachedData<T>({
  cacheKey,
  fetcher,
  ttlMs = DEFAULT_TTL_MS,
  initialData = null,
  revalidateOnMount = false
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState(initialData == null);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchRef = useRef(fetcher);

  useEffect(() => {
    fetchRef.current = fetcher;
  }, [fetcher]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const next = await fetchRef.current();
      writeCache(cacheKey, next, ttlMs);
      startTransition(() => {
        setData(next);
        setIsStale(false);
      });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to refresh cached data.");
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, ttlMs]);

  useEffect(() => {
    const cached = readCache<T>(cacheKey);
    let frame = 0;

    if (cached?.payload) {
      frame = window.requestAnimationFrame(() => {
        startTransition(() => {
          setData(cached.payload);
          setIsStale(cached.expiresAt <= Date.now());
          setIsLoading(false);
        });
      });

      if (!revalidateOnMount && cached.expiresAt > Date.now()) {
        return () => {
          if (frame) {
            window.cancelAnimationFrame(frame);
          }
        };
      }
    }

    frame = window.requestAnimationFrame(() => {
      void refresh();
    });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [cacheKey, refresh, revalidateOnMount]);

  return {
    data,
    isLoading,
    isStale,
    error,
    refresh
  };
}
