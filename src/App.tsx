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
