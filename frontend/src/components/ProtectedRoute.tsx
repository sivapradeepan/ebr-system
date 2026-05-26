import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface Props {
  children: React.ReactNode;
  permission?: string;
}

export default function ProtectedRoute({ children, permission }: Props) {
  const { isAuthenticated, hasPermission } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return <Navigate to="/403" replace />;

  return <>{children}</>;
}
