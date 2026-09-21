/**
 * Loads an external script once and resolves when it is ready. Used to pull in
 * Google's and Facebook's sign-in libraries only on the pages that need them,
 * and only when those providers are configured — so visitors who never open a
 * login page download nothing extra.
 */
const pending = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Forget the failure so a later attempt (e.g. after the network returns) can retry.
      pending.delete(src);
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });

  pending.set(src, promise);
  return promise;
}
