import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import NoticeBanner from "@/components/common/NoticeBanner";
import NoticePopup from "@/components/common/NoticePopup";
// Loaded after the page itself: the chat is never needed for the first paint.
const LycieChat = lazy(() => import("@/components/lycie/LycieChat"));

export default function Layout() {
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
      <Suspense fallback={null}>
        <LycieChat />
      </Suspense>
    </div>
  );
}
