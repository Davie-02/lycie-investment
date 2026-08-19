import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import NoticeBanner from "@/components/common/NoticeBanner";
import NoticePopup from "@/components/common/NoticePopup";

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
    </div>
  );
}
