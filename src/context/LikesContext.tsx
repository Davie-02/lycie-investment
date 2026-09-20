import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getLikeCounts, setLike, type LikeKind } from "@/services/likes.service";
import { subscribeLive } from "@/services/liveContent";

const VISITOR_KEY = "lycie_visitor_id";
const LIKES_KEY = "lycie_likes";

/** A random id this browser keeps, so one visitor can like once and undo — it identifies no one. */
function loadVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID(); // storage blocked: likes still work for this page view
  }
}

function loadLiked(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIKES_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

const keyOf = (kind: LikeKind, id: string) => `${kind}:${id}`;

interface LikesContextValue {
  isLiked: (kind: LikeKind, id: string) => boolean;
  count: (kind: LikeKind, id: string) => number;
  /** Ask for this item's like count (batched with everything else on screen). */
  register: (kind: LikeKind, id: string) => void;
  toggle: (kind: LikeKind, id: string) => Promise<boolean>;
}

const LikesContext = createContext<LikesContextValue | null>(null);

export function LikesProvider({ children }: { children: ReactNode }) {
  const visitorId = useMemo(loadVisitorId, []);
  const [liked, setLiked] = useState<Set<string>>(loadLiked);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const known = useRef<Map<LikeKind, Set<string>>>(new Map());
  const queued = useRef<Map<LikeKind, Set<string>>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCounts = useCallback(async (kind: LikeKind, ids: string[]) => {
    for (let i = 0; i < ids.length; i += 100) {
      try {
        const { counts: fresh } = await getLikeCounts(kind, ids.slice(i, i + 100));
        setCounts((prev) => {
          const next = { ...prev };
          for (const id of ids.slice(i, i + 100)) next[keyOf(kind, id)] = fresh[id] ?? 0;
          return next;
        });
      } catch {
        // Counts are decoration — never let a failure here break a page.
      }
    }
  }, []);

  const register = useCallback(
    (kind: LikeKind, id: string) => {
      const set = known.current.get(kind) ?? new Set<string>();
      if (set.has(id)) return;
      set.add(id);
      known.current.set(kind, set);
      const wait = queued.current.get(kind) ?? new Set<string>();
      wait.add(id);
      queued.current.set(kind, wait);
      // One request for every card that mounted in the same moment.
      if (!timer.current) {
        timer.current = setTimeout(() => {
          timer.current = null;
          const batches = [...queued.current.entries()];
          queued.current = new Map();
          for (const [k, ids] of batches) void fetchCounts(k, [...ids]);
        }, 60);
      }
    },
    [fetchCounts]
  );

  // Someone (anywhere) liked something: refresh the counts on screen, at most every 2s.
  useEffect(() => {
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      for (const [kind, ids] of known.current) if (ids.size) void fetchCounts(kind, [...ids]);
    };
    const unsubscribe = subscribeLive(["likes"], () => {
      const wait = Math.max(0, 2_000 - (Date.now() - last));
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        last = Date.now();
        refresh();
      }, wait);
    });
    return () => {
      unsubscribe();
      if (pending) clearTimeout(pending);
    };
  }, [fetchCounts]);

  const persist = (next: Set<string>) => {
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify([...next]));
    } catch {
      // ignore — the like is still recorded on the server
    }
  };

  const toggle = useCallback(
    async (kind: LikeKind, id: string) => {
      const key = keyOf(kind, id);
      const willLike = !liked.has(key);

      // Optimistic: the heart and number change instantly; rolled back if the server refuses.
      const apply = (on: boolean) => {
        setLiked((prev) => {
          const next = new Set(prev);
          if (on) next.add(key);
          else next.delete(key);
          persist(next);
          return next;
        });
        setCounts((prev) => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + (on ? 1 : -1)) }));
      };
      apply(willLike);
      try {
        const { count } = await setLike(kind, id, visitorId, willLike);
        setCounts((prev) => ({ ...prev, [key]: count }));
        return willLike;
      } catch {
        apply(!willLike);
        return !willLike;
      }
    },
    [liked, visitorId]
  );

  const value = useMemo<LikesContextValue>(
    () => ({
      isLiked: (kind, id) => liked.has(keyOf(kind, id)),
      count: (kind, id) => counts[keyOf(kind, id)] ?? 0,
      register,
      toggle,
    }),
    [liked, counts, register, toggle]
  );

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikes(): LikesContextValue {
  const context = useContext(LikesContext);
  if (!context) throw new Error("useLikes must be used within a LikesProvider.");
  return context;
}
