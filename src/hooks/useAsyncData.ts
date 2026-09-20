import { useEffect, useRef, useState } from "react";
import { subscribeLive } from "@/services/liveContent";

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Wraps an async loader with loading/error/data state so every screen that
 * reads data (vehicles, hire listings, etc.) handles all three the same way.
 *
 * Pass `live` topics (e.g. ["vehicles"]) to keep the data current: when an
 * admin changes that content the loader re-runs in the background and the new
 * data replaces the old without any loading flicker.
 */
export function useAsyncData<T>(loader: () => Promise<T>, deps: unknown[] = [], live: string[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: true,
    error: null,
  });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, isLoading: true, error: null });

    loader()
      .then((data) => {
        if (!cancelled) setState({ data, isLoading: false, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Something went wrong.";
          setState({ data: null, isLoading: false, error: message });
        }
      });

    // Background refresh on live changes: keep what's on screen if the refetch fails.
    const unsubscribe = live.length
      ? subscribeLive(live, () => {
          loaderRef
            .current()
            .then((data) => {
              if (!cancelled) setState({ data, isLoading: false, error: null });
            })
            .catch(() => undefined);
        })
      : undefined;

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
