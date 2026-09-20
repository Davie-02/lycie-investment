/**
 * Live content updates. The API pushes a tiny "topic changed" message
 * (Server-Sent Events) whenever an admin saves something; components that
 * subscribe to that topic quietly refetch. The stream is only open while the
 * tab is visible, so background tabs don't hold a connection open, and on
 * return (or reconnect) everything resyncs so no change is ever missed.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 3_000;

function notify(topic?: string) {
  const targets = topic ? [listeners.get(topic)] : [...listeners.values()];
  for (const set of targets) set?.forEach((listener) => listener());
}

function hasListeners() {
  return [...listeners.values()].some((set) => set.size > 0);
}

function disconnect() {
  source?.close();
  source = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
}

function connect() {
  if (source || !hasListeners() || document.visibilityState === "hidden" || typeof EventSource === "undefined") return;

  const stream = new EventSource(`${API_BASE_URL}/events`);
  source = stream;
  let firstOpen = true;

  stream.addEventListener("ready", () => {
    retryDelay = 3_000;
    // After a reconnect we may have missed changes — refetch everything once.
    if (!firstOpen) notify();
    firstOpen = false;
  });
  stream.addEventListener("change", (event) => {
    try {
      notify((JSON.parse((event as MessageEvent).data) as { topic: string }).topic);
    } catch {
      notify();
    }
  });
  stream.onerror = () => {
    // The browser retries by itself while the stream is "connecting"; only a
    // hard close (e.g. the server said it's busy) needs our own back-off.
    if (stream.readyState === EventSource.CLOSED) {
      disconnect();
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 60_000);
    }
  };
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      disconnect();
    } else {
      connect();
      notify(); // coming back to the tab: make sure nothing is stale
    }
  });
}

/** Calls `listener` whenever any of `topics` changes. Returns an unsubscribe function. */
export function subscribeLive(topics: string[], listener: Listener): () => void {
  for (const topic of topics) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)!.add(listener);
  }
  connect();
  return () => {
    for (const topic of topics) listeners.get(topic)?.delete(listener);
    if (!hasListeners()) disconnect();
  };
}
