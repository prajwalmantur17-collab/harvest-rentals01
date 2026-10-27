import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { RequireRole, RootRedirect } from './auth/guards'
import { ToastProvider } from './components/Toast'
import { I18nProvider } from './i18n'
import { NotificationsProvider } from './notifications/NotificationsContext'
import Login from './pages/Login'
import MachineDetail from './pages/MachineDetail'
import NotFound from './pages/NotFound'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import RoleSelect from './pages/RoleSelect'
import FarmerHome from './pages/farmer/FarmerHome'
import MyBookings from './pages/farmer/MyBookings'
import SearchResults from './pages/farmer/SearchResults'
import Availability from './pages/owner/Availability'
import MachineForm from './pages/owner/MachineForm'
import MyMachines from './pages/owner/MyMachines'
import OwnerBookings from './pages/owner/OwnerBookings'
import OwnerHome from './pages/owner/OwnerHome'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/role" element={<RoleSelect />} />

      <Route path="/farmer" element={<RequireRole role="farmer"><FarmerHome /></RequireRole>} />
      <Route path="/farmer/search" element={<RequireRole role="farmer"><SearchResults /></RequireRole>} />
      <Route path="/farmer/bookings" element={<RequireRole role="farmer"><MyBookings /></RequireRole>} />

      <Route path="/owner" element={<RequireRole role="owner"><OwnerHome /></RequireRole>} />
      <Route path="/owner/machines" element={<RequireRole role="owner"><MyMachines /></RequireRole>} />
      <Route path="/owner/machines/new" element={<RequireRole role="owner"><MachineForm /></RequireRole>} />
      <Route path="/owner/machines/:id/edit" element={<RequireRole role="owner"><MachineForm /></RequireRole>} />
      <Route path="/owner/machines/:id/availability" element={<RequireRole role="owner"><Availability /></RequireRole>} />
      <Route path="/owner/bookings" element={<RequireRole role="owner"><OwnerBookings /></RequireRole>} />

      <Route path="/machine/:id" element={<RequireRole><MachineDetail /></RequireRole>} />
      <Route path="/notifications" element={<RequireRole><Notifications /></RequireRole>} />
      <Route path="/profile" element={<RequireRole><Profile /></RequireRole>} />

      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <AuthProvider>
          <NotificationsProvider>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </NotificationsProvider>
        </AuthProvider>
      </ToastProvider>
    </I18nProvider>
  )
}
