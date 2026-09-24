/**
 * Dashboard numbers for every module the person can see (GET /workspace/summary).
 *
 * Shared by the sidebar badges, the home dashboard and module dashboards, so
 * it's fetched once, kept for 30 seconds, and refreshed quietly in the
 * background (when the tab regains focus, or after an undo) — screens show the
 * last numbers instantly instead of waiting.
 */
import { useEffect, useState } from "react";
import { adminApi, ADMIN_WRITE_EVENT, DATA_CHANGED_EVENT } from "../adminApi";
import { subscribeLive } from "@/services/liveContent";

/** Changes (by anyone) that move dashboard numbers. */
const LIVE_TOPICS = ["vehicles", "hire-vehicles", "reviews", "deals", "faq", "testimonials", "blog-posts", "notices", "shipments", "pricing"];
import type { ModuleKey } from "../access";

export interface Stat {
  key: string;
  label: string;
  value: number;
  path: string;
  attention?: boolean;
}

export type WorkspaceSummary = Partial<Record<ModuleKey, Stat[]>>;

const FRESH_MS = 30_000;
let cached: { at: number; data: WorkspaceSummary } | null = null;
let inFlight: Promise<WorkspaceSummary> | null = null;
const listeners = new Set<(data: WorkspaceSummary) => void>();

function load(force = false): Promise<WorkspaceSummary> {
  if (!force && cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.data);
  inFlight ??= adminApi
    .get<WorkspaceSummary>("/workspace/summary")
    .then((data) => {
      cached = { at: Date.now(), data };
      listeners.forEach((listener) => listener(data));
      return data;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Forget the numbers (e.g. on sign-out) so the next person doesn't see them. */
export function clearWorkspaceSummary(): void {
  cached = null;
}

export function useWorkspaceSummary(): { data: WorkspaceSummary | null; error: boolean } {
  const [data, setData] = useState<WorkspaceSummary | null>(cached?.data ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    listeners.add(setData);
    load()
      .then(setData)
      .catch(() => setError(true));
    const refresh = () => void load(true).catch(() => undefined);
    const onFocus = () => document.visibilityState === "visible" && void load().catch(() => undefined);
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    window.addEventListener(ADMIN_WRITE_EVENT, refresh);
    document.addEventListener("visibilitychange", onFocus);
    const stopLive = subscribeLive(LIVE_TOPICS, refresh);
    return () => {
      stopLive();
      listeners.delete(setData);
      window.removeEventListener(DATA_CHANGED_EVENT, refresh);
      window.removeEventListener(ADMIN_WRITE_EVENT, refresh);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return { data, error };
}

/** How many things need attention in a module (for the sidebar badge). */
export function attentionCount(stats: Stat[] | undefined): number {
  return (stats ?? []).filter((stat) => stat.attention).reduce((sum, stat) => sum + stat.value, 0);
}
