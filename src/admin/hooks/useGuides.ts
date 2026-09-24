/**
 * The "About this page" guides meant for the signed-in staff member
 * (GET /workspace/guides). Fetched once and shared; refreshed the moment an
 * administrator edits a guide (live "guides" topic).
 */
import { useEffect, useState } from "react";
import { subscribeLive } from "@/services/liveContent";
import { adminApi } from "../adminApi";

export interface Guide {
  key: string;
  title: string;
  body: string;
}

let cache: Map<string, Guide> | null = null;
let inFlight: Promise<Map<string, Guide>> | null = null;
const listeners = new Set<(guides: Map<string, Guide>) => void>();

function load(force = false): Promise<Map<string, Guide>> {
  if (cache && !force) return Promise.resolve(cache);
  inFlight ??= adminApi
    .get<Guide[]>("/workspace/guides")
    .then((list) => {
      cache = new Map(list.map((guide) => [guide.key, guide]));
      listeners.forEach((listener) => listener(cache!));
      return cache;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Forget guides on sign-out (the next person may see different ones). */
export function clearGuides(): void {
  cache = null;
}

export function useGuides(): Map<string, Guide> | null {
  const [guides, setGuides] = useState<Map<string, Guide> | null>(cache);
  useEffect(() => {
    listeners.add(setGuides);
    load()
      .then(setGuides)
      .catch(() => undefined);
    const stop = subscribeLive(["guides"], () => void load(true).catch(() => undefined));
    return () => {
      listeners.delete(setGuides);
      stop();
    };
  }, []);
  return guides;
}

export function useGuide(key: string | null): Guide | null {
  const guides = useGuides();
  return key ? guides?.get(key) ?? null : null;
}
