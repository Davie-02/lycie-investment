import { Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Home from "@/pages/Home/Home";
import About from "@/pages/About/About";
import Vehicles from "@/pages/Vehicles/Vehicles";
import VehicleDetails from "@/pages/VehicleDetails/VehicleDetails";
import Import from "@/pages/Import/Import";
import Clearing from "@/pages/Clearing/Clearing";
import Hire from "@/pages/Hire/Hire";
import Contact from "@/pages/Contact/Contact";

import { AdminAuthProvider } from "@/admin/context/AdminAuthContext";
import ProtectedRoute from "@/admin/components/ProtectedRoute";
import RequireRole from "@/admin/components/RequireRole";
import AdminLayout from "@/admin/components/AdminLayout";
import AdminLogin from "@/admin/pages/AdminLogin";
import AdminDashboard from "@/admin/pages/AdminDashboard";
import AdminVehicles from "@/admin/pages/AdminVehicles";
import AdminHireVehicles from "@/admin/pages/AdminHireVehicles";
import AdminRequests from "@/admin/pages/AdminRequests";
import AdminBookings from "@/admin/pages/AdminBookings";
import AdminBookingDetail from "@/admin/pages/AdminBookingDetail";
import AdminSiteContent from "@/admin/pages/AdminSiteContent";
import AdminNotices from "@/admin/pages/AdminNotices";
import AdminUsers from "@/admin/pages/AdminUsers";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/vehicles/:slug" element={<VehicleDetails />} />
        <Route path="/import" element={<Import />} />
        <Route path="/clearing" element={<Clearing />} />
        <Route path="/hire" element={<Hire />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
      </Route>

      {/* Admin routes are wrapped in their own auth provider and layout —
          deliberately separate from the public Layout (no public nav/footer). */}
      <Route
        path="/admin/*"
        element={
          <AdminAuthProvider>
            <Routes>
              <Route path="login" element={<AdminLogin />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="vehicles" element={<AdminVehicles />} />
                  <Route path="hire-vehicles" element={<AdminHireVehicles />} />
                  <Route path="requests" element={<AdminRequests />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="bookings/:id" element={<AdminBookingDetail />} />
                  <Route element={<RequireRole roles={["OWNER", "MANAGER"]} />}>
                    <Route path="site-content" element={<AdminSiteContent />} />
                    <Route path="notices" element={<AdminNotices />} />
                  </Route>
                  <Route element={<RequireRole roles={["OWNER"]} />}>
                    <Route path="users" element={<AdminUsers />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </AdminAuthProvider>
        }
      />
    </Routes>
  );
}
