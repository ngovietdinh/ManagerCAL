import { lazy, Suspense, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "./app/data";
import { Loading, UiProvider } from "./components/ui";
import MainLayout from "./layouts/MainLayout";
import Login from "./pages/Login";
import Lookup from "./pages/Lookup";
import type { Action } from "./lib/perm";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Devices = lazy(() => import("./pages/Devices"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderNew = lazy(() => import("./pages/OrderNew"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Jobs = lazy(() => import("./pages/Jobs"));
const JobDetail = lazy(() => import("./pages/JobDetail"));
const Certificates = lazy(() => import("./pages/Certificates"));
const CertificateDetail = lazy(() => import("./pages/CertificateDetail"));
const Seals = lazy(() => import("./pages/Seals"));
const Standards = lazy(() => import("./pages/Standards"));
const Staff = lazy(() => import("./pages/Staff"));
const Catalog = lazy(() => import("./pages/Catalog"));
const Reports = lazy(() => import("./pages/Reports"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Audit = lazy(() => import("./pages/Audit"));
const Chat = lazy(() => import("./pages/Chat"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { me } = useData();
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireCan({ action, children }: { action: Action; children: ReactNode }) {
  const { can } = useData();
  if (!can(action)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <UiProvider>
      <div className="app-bg" aria-hidden />
      <DataProvider fallback={<Loading text="Đang khởi động…" />}>
        <HashRouter>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/lookup" element={<Lookup />} />
              <Route path="/lookup/:number" element={<Lookup />} />
              <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
                <Route index element={<Dashboard />} />
                <Route path="chat" element={<Chat />} />
                <Route path="chat/:channel" element={<Chat />} />
                <Route path="customers" element={<Customers />} />
                <Route path="customers/:id" element={<CustomerDetail />} />
                <Route path="devices" element={<Devices />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/new" element={<RequireCan action="orders"><OrderNew /></RequireCan>} />
                <Route path="orders/:id" element={<OrderDetail />} />
                <Route path="jobs" element={<Jobs />} />
                <Route path="jobs/:id" element={<JobDetail />} />
                <Route path="certificates" element={<Certificates />} />
                <Route path="certificates/:id" element={<CertificateDetail />} />
                <Route path="seals" element={<Seals />} />
                <Route path="standards" element={<Standards />} />
                <Route path="staff" element={<Staff />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="reports" element={<RequireCan action="reports"><Reports /></RequireCan>} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<RequireCan action="settings"><Settings /></RequireCan>} />
                <Route path="audit" element={<RequireCan action="audit"><Audit /></RequireCan>} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </HashRouter>
      </DataProvider>
    </UiProvider>
  );
}
