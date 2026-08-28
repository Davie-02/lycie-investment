import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

import { AdminAuthProvider } from "@/admin/context/AdminAuthContext";
import ProtectedRoute from "@/admin/components/ProtectedRoute";
import RequireRole from "@/admin/components/RequireRole";

const Home = lazy(() => import("@/pages/Home/Home"));
const About = lazy(() => import("@/pages/About/About"));
const Vehicles = lazy(() => import("@/pages/Vehicles/Vehicles"));
const VehicleDetails = lazy(() => import("@/pages/VehicleDetails/VehicleDetails"));
const Import = lazy(() => import("@/pages/Import/Import"));
const Clearing = lazy(() => import("@/pages/Clearing/Clearing"));
const Hire = lazy(() => import("@/pages/Hire/Hire"));
const Contact = lazy(() => import("@/pages/Contact/Contact"));
const CustomerLogin = lazy(() => import("@/pages/Customer/CustomerLogin"));
const CustomerRegister = lazy(() => import("@/pages/Customer/CustomerRegister"));
const CustomerAccount = lazy(() => import("@/pages/Customer/CustomerAccount"));
const AdminLayout = lazy(() => import("@/admin/components/AdminLayout"));
const AdminLogin = lazy(() => import("@/admin/pages/AdminLogin"));
const AdminDashboard = lazy(() => import("@/admin/pages/AdminDashboard"));
const AdminVehicles = lazy(() => import("@/admin/pages/AdminVehicles"));
const AdminHireVehicles = lazy(() => import("@/admin/pages/AdminHireVehicles"));
const AdminRequests = lazy(() => import("@/admin/pages/AdminRequests"));
const AdminBookings = lazy(() => import("@/admin/pages/AdminBookings"));
const AdminBookingDetail = lazy(() => import("@/admin/pages/AdminBookingDetail"));
const AdminSiteContent = lazy(() => import("@/admin/pages/AdminSiteContent"));
const AdminNotices = lazy(() => import("@/admin/pages/AdminNotices"));
const AdminUsers = lazy(() => import("@/admin/pages/AdminUsers"));
const AdminPayments = lazy(() => import("@/admin/pages/AdminPayments"));

function CustomerAccountRoute() {
  const { isAuthenticated } = useCustomerAuth();
  return isAuthenticated ? <CustomerAccount /> : <CustomerLogin />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="route-loading">Loading...</div>}>
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
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/account/register" element={<CustomerRegister />} />
        <Route path="/account" element={<CustomerAccountRoute />} />
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
                    <Route path="payments" element={<AdminPayments />} />
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
    </Suspense>
  );
}
