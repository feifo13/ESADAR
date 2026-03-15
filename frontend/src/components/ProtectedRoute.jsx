import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ProtectedRoute({ children, roles = [] }) {
  const location = useLocation();
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div className="container section-card">Cargando sesión…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (roles.length && !user?.roles?.some((role) => roles.includes(role))) {
    return (
      <div className="container">
        <div className="section-card centered-card">
          <h2>No tienes acceso a esta vista</h2>
          <p>Necesitas un rol de backoffice para continuar.</p>
        </div>
      </div>
    );
  }

  return children;
}
