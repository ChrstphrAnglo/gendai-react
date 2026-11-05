import { Navigate, useLocation } from 'react-router-dom';
import { homeFor, useAuth } from '../../context/AuthContext';

// <ProtectedRoute roles={['admin']}> ... </ProtectedRoute>
// Not logged in → /login (remembering where they were going). Wrong role → that account's home page.
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
        <p>Loading…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}
