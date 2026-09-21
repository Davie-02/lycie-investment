/**
 * Top of the React tree. Wraps every page in the app-wide providers (site content,
 * notices, customer sign-in, saved vehicles, likes) and the router, so any component can
 * use them. Page URLs are declared in routes/AppRoutes.tsx.
 */
import { BrowserRouter } from "react-router-dom";
import { SiteContentProvider } from "@/context/SiteContentContext";
import { NoticesProvider } from "@/context/NoticesContext";
import { CustomerAuthProvider } from "@/context/CustomerAuthContext";
import { SavedVehiclesProvider } from "@/context/SavedVehiclesContext";
import { LikesProvider } from "@/context/LikesContext";
import AppRoutes from "@/routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <SiteContentProvider>
        <NoticesProvider>
          <CustomerAuthProvider>
            <SavedVehiclesProvider>
              <LikesProvider>
                <AppRoutes />
              </LikesProvider>
            </SavedVehiclesProvider>
          </CustomerAuthProvider>
        </NoticesProvider>
      </SiteContentProvider>
    </BrowserRouter>
  );
}
