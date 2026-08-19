import { BrowserRouter } from "react-router-dom";
import { SiteContentProvider } from "@/context/SiteContentContext";
import { NoticesProvider } from "@/context/NoticesContext";
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <SiteContentProvider>
        <NoticesProvider>
          <AppRoutes />
        </NoticesProvider>
      </SiteContentProvider>
    </BrowserRouter>
  );
}
