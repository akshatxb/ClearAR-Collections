import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { useAuth } from './context/useAuth';
import ProtectedRoute from './components/ProtectedRoute';
import { defaultRouteFor } from './lib/routes';
import AppLayout from './components/AppLayout';
import Toaster from './components/Toaster';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Worklist from './pages/collector/Worklist';
import AccountDetail from './pages/collector/AccountDetail';
import Promises from './pages/collector/Promises';
import CoActorTasks from './pages/relationship/CoActorTasks';
import Dashboard from './pages/manager/Dashboard';
import PriorityFactors from './pages/manager/PriorityFactors';
import Analytics from './pages/manager/Analytics';
import Admin from './pages/manager/Admin';
import MyStats from './pages/shared/MyStats';
import CustomerPortal from './pages/customer/CustomerPortal';
import PlatformAdmin from './pages/admin/PlatformAdmin';
import PlatformOrgDetail from './pages/admin/PlatformOrgDetail';
import PlatformActivity from './pages/admin/PlatformActivity';
import PlatformTeam from './pages/admin/PlatformTeam';

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={defaultRouteFor(user.role)} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Toaster />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

          <Route
            element={
              <ProtectedRoute roles={['manager', 'collector', 'relationship_owner']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/worklist" element={<Worklist />} />
            <Route path="/promises" element={<Promises />} />
            <Route path="/accounts/:id" element={<AccountDetail />} />
            <Route path="/tasks" element={<CoActorTasks />} />
            <Route path="/my-stats" element={<MyStats />} />
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['manager']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/priority-factors" element={<PriorityFactors />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['customer']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/portal" element={<CustomerPortal />} />
          </Route>

          <Route
            element={
              <ProtectedRoute roles={['platform_admin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/platform-admin" element={<PlatformAdmin />} />
            <Route path="/platform-admin/orgs/:id" element={<PlatformOrgDetail />} />
            <Route path="/platform-admin/activity" element={<PlatformActivity />} />
            <Route path="/platform-admin/team" element={<PlatformTeam />} />
          </Route>

          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
