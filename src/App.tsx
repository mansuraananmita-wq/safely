import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AdminLayout } from './layouts/AdminLayout'
import { ReporterLayout } from './layouts/ReporterLayout'
import { AdminReportsPage } from './pages/admin/AdminReports'
import { DepartmentQueuesPage } from './pages/admin/DepartmentQueues'
import { AnnouncementsPage, AuditPage, CategoriesPage, DepartmentsPage, SupportContactsPage, UsersPage } from './pages/admin/Manage'
import { OverviewPage } from './pages/admin/Overview'
import { ReviewPage } from './pages/admin/Review'
import { SafeWalkPage } from './pages/admin/SafeWalk'
import { Forgot, Login, Register, Verify } from './pages/AuthPages'
import Landing from './pages/Landing'
import { NotificationsPage } from './pages/Notifications'
import PublicStatus from './pages/PublicStatus'
import { HomePage } from './pages/reporter/Home'
import { SosPage } from './pages/Sos'
import { ProfilePage } from './pages/Profile'
import { AlertsPage, HelpPage, LostFoundPage, MapPage } from './pages/reporter/MorePages'
import { MyReportsPage } from './pages/reporter/MyReports'
import { NewReportPage } from './pages/reporter/NewReport'
import { ReportDetailPage } from './pages/reporter/ReportDetail'
import { homePath, isMember } from './logic'
import { useApp } from './store'

function Guard({ mode }: { mode: 'member' | 'desk' }) {
  const { currentUser, ready, tx } = useApp()
  const location = useLocation()
  if (!ready) return <p className="px-4 py-10 text-sm">{tx('Loading the campus desk.', 'ক্যাম্পাস ডেস্ক লোড হচ্ছে।')}</p>
  if (!currentUser || currentUser.suspended) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  if (mode === 'member' && !isMember(currentUser.role)) return <Navigate to={homePath(currentUser.role)} replace />
  if (mode === 'desk' && isMember(currentUser.role)) return <Navigate to="/app" replace />
  return <Outlet />
}

function OperationsOnly() {
  const { currentUser } = useApp()
  if (!currentUser) return <Navigate to="/login" replace />
  if (currentUser.role !== 'admin') return <Navigate to={homePath(currentUser.role)} replace />
  return <Outlet />
}

function NotFound() {
  const { tx } = useApp()
  return (
    <div className="mx-auto max-w-lg px-4 py-20">
      <h1 className="font-display text-4xl">{tx('This page is not on the campus map.', 'এই পাতাটি ক্যাম্পাস ম্যাপে নেই।')}</h1>
      <a href="/" className="mt-4 inline-block font-semibold text-teal-800">{tx('Go home', 'হোমে যান')}</a>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/status" element={<PublicStatus />} />
      <Route element={<Guard mode="member" />}>
        <Route element={<ReporterLayout />}>
          <Route path="/app" element={<HomePage />} />
          <Route path="/app/reports" element={<MyReportsPage />} />
          <Route path="/app/reports/:id" element={<ReportDetailPage />} />
          <Route path="/app/report/new" element={<NewReportPage />} />
          <Route path="/app/map" element={<MapPage />} />
          <Route path="/app/alerts" element={<AlertsPage />} />
          <Route path="/app/lost" element={<LostFoundPage />} />
          <Route path="/app/help" element={<HelpPage />} />
          <Route path="/app/sos" element={<SosPage />} />
          <Route path="/app/profile" element={<ProfilePage />} />
          <Route path="/app/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route element={<Guard mode="desk" />}>
        <Route element={<AdminLayout />}>
          <Route element={<OperationsOnly />}>
            <Route path="/admin" element={<OverviewPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/departments" element={<DepartmentsPage />} />
            <Route path="/admin/alerts" element={<AnnouncementsPage />} />
            <Route path="/admin/help" element={<SupportContactsPage />} />
            <Route path="/admin/audit" element={<AuditPage />} />
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/categories" element={<CategoriesPage />} />
          </Route>
          <Route path="/admin/reports/:id" element={<ReviewPage />} />
          <Route path="/admin/queues" element={<DepartmentQueuesPage />} />
          <Route path="/admin/profile" element={<ProfilePage />} />
          <Route path="/admin/sos" element={<SosPage />} />
          <Route path="/admin/safe-walk" element={<SafeWalkPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
