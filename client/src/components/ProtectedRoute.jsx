import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { defaultRouteFor } from '../lib/routes';

export default function ProtectedRoute({ roles, children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={defaultRouteFor(user.role)} replace />;
  }
  return children;
}
