/**
 * Every page address on the site. Public pages sit inside the shared Layout (navigation
 * + footer); /admin/* has its own auth provider and layout and is split by role (Owner-
 * only, Owner/Manager, everyone signed in). Pages load on demand (lazy) so the first
 * visit downloads less. To add a page: create it, add a <Route> here, and link to it.
 */
import { lazy, Suspense } from "react";
import { Navigate, Routes, Route } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

import { AdminAuthProvider } from "@/admin/context/AdminAuthContext";
import ProtectedRoute from "@/admin/components/ProtectedRoute";
import RequireAccess from "@/admin/components/RequireAccess";
import { EXTRA_PAGES, MODULES, MODULE_HOME, WORKSPACE_PAGES, lazyPage } from "@/admin/modules";

const ModuleHome = lazyPage(MODULE_HOME);

const Home = lazy(() => import("@/pages/Home/Home"));
const About = lazy(() => import("@/pages/About/About"));
const Vehicles = lazy(() => import("@/pages/Vehicles/Vehicles"));
const VehicleDetails = lazy(() => import("@/pages/VehicleDetails/VehicleDetails"));
const Import = lazy(() => import("@/pages/Import/Import"));
const Clearing = lazy(() => import("@/pages/Clearing/Clearing"));
const Hire = lazy(() => import("@/pages/Hire/Hire"));
const Contact = lazy(() => import("@/pages/Contact/Contact"));
const Deals = lazy(() => import("@/pages/Deals/Deals"));
const Compare = lazy(() => import("@/pages/Compare/Compare"));
const Faq = lazy(() => import("@/pages/Faq/Faq"));
const Reviews = lazy(() => import("@/pages/Reviews/Reviews"));
const BlogList = lazy(() => import("@/pages/Blog/BlogList"));
const BlogPost = lazy(() => import("@/pages/Blog/BlogPost"));
const CustomerLogin = lazy(() => import("@/pages/Customer/CustomerLogin"));
const CustomerRegister = lazy(() => import("@/pages/Customer/CustomerRegister"));
// The customer portal: a layout with a section menu, and one page per section.
const PortalLayout = lazy(() => import("@/pages/Customer/portal/PortalLayout"));
const PortalOverview = lazy(() => import("@/pages/Customer/portal/Overview"));
const PortalTrack = lazy(() => import("@/pages/Customer/portal/TrackVehicle"));
const PortalRequests = lazy(() => import("@/pages/Customer/portal/Requests"));
const PortalPayments = lazy(() => import("@/pages/Customer/portal/Payments"));
const PortalSaved = lazy(() => import("@/pages/Customer/portal/Saved"));
const PortalMessages = lazy(() => import("@/pages/Customer/portal/Messages"));
const PortalInvite = lazy(() => import("@/pages/Customer/portal/Invite"));
const PortalSettings = lazy(() => import("@/pages/Customer/portal/Settings"));
const ForgotPassword = lazy(() => import("@/pages/Customer/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/Customer/ResetPassword"));
const VerifyEmail = lazy(() => import("@/pages/Customer/VerifyEmail"));
const AdminLayout = lazy(() => import("@/admin/components/AdminLayout"));
const AdminLogin = lazy(() => import("@/admin/pages/AdminLogin"));
const AdminForgotPassword = lazy(() => import("@/admin/pages/AdminForgotPassword"));
const AdminResetPassword = lazy(() => import("@/admin/pages/AdminResetPassword"));
const PaymentReturn = lazy(() => import("@/pages/Customer/PaymentReturn"));

function CustomerAccountRoute() {
  const { isAuthenticated } = useCustomerAuth();
  // Signed out: the sign-in form in place (the address is kept, so they return to the same section).
  return isAuthenticated ? <PortalLayout /> : <CustomerLogin />;
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
        <Route path="/deals" element={<Deals />} />
        <Route path="/compare" element={<Compare />} />
        {/* Tracking is only in customers' own accounts; old /track links go there (sign-in first if needed). */}
        <Route path="/track" element={<Navigate to="/account/track" replace />} />
        <Route path="/account/payment-return" element={<PaymentReturn />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/blog" element={<BlogList />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/account/login" element={<CustomerLogin />} />
        <Route path="/account/register" element={<CustomerRegister />} />
        <Route path="/account/forgot-password" element={<ForgotPassword />} />
        <Route path="/account/reset-password" element={<ResetPassword />} />
        <Route path="/account/verify-email" element={<VerifyEmail />} />
        <Route path="/account" element={<CustomerAccountRoute />}>
          <Route index element={<PortalOverview />} />
          <Route path="track" element={<PortalTrack />} />
          <Route path="requests" element={<PortalRequests />} />
          <Route path="payments" element={<PortalPayments />} />
          <Route path="saved" element={<PortalSaved />} />
          <Route path="messages" element={<PortalMessages />} />
          <Route path="invite" element={<PortalInvite />} />
          <Route path="settings" element={<PortalSettings />} />
        </Route>
        </Route>

      {/* Admin routes are wrapped in their own auth provider and layout —
          deliberately separate from the public Layout (no public nav/footer). */}
        <Route
          path="/admin/*"
          element={
            <AdminAuthProvider>
              <Routes>
              <Route path="login" element={<AdminLogin />} />
              <Route path="forgot-password" element={<AdminForgotPassword />} />
              <Route path="reset-password" element={<AdminResetPassword />} />
              <Route element={<ProtectedRoute />}>
                {/* Every page comes from the module map (admin/modules.ts), each guarded by its module access. */}
                <Route element={<AdminLayout />}>
                  {[...WORKSPACE_PAGES, ...EXTRA_PAGES].map((page) => {
                    const Page = lazyPage(page.load);
                    return page.path === "/admin" ? (
                      <Route key={page.path} index element={<Page />} />
                    ) : (
                      <Route key={page.path} path={page.path.replace(/^\/admin\//, "")} element={<Page />} />
                    );
                  })}
                  <Route path="m/:module" element={<ModuleHome />} />
                  {MODULES.flatMap((module) =>
                    module.pages.map((page) => {
                      const Page = lazyPage(page.load);
                      return (
                        <Route
                          key={`${module.key}${page.path}`}
                          path={page.path.replace(/^\/admin\//, "")}
                          element={
                            <RequireAccess module={module.key} level={page.level} systemAdminOnly={page.systemAdminOnly}>
                              <Page />
                            </RequireAccess>
                          }
                        />
                      );
                    })
                  )}
                  <Route path="*" element={<Navigate to="/admin" replace />} />
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
