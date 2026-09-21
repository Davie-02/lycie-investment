import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import NoticeBanner from "@/components/common/NoticeBanner";
import NoticePopup from "@/components/common/NoticePopup";
// Loaded after the page itself: the chat is never needed for the first paint.
const LycieChat = lazy(() => import("@/components/lycie/LycieChat"));

/**
 * True once the browser has nothing better to do (or after 3 seconds at most). Used to hold back
 * non-essential widgets so they never compete with the content a visitor came for.
 */
function useIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) {
      const handle = ric(() => setIdle(true), { timeout: 3000 });
      return () => (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(() => setIdle(true), 2000);
    return () => window.clearTimeout(timer);
  }, []);
  return idle;
}

export default function Layout() {
  const idle = useIdle();
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <NoticeBanner />
      <Navbar />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      <NoticePopup />
      {/* The chat downloads only after the page has settled. */}
      {idle && (
        <Suspense fallback={null}>
          <LycieChat />
        </Suspense>
      )}
    </div>
  );
}
