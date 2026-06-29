import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';
import PageLoader from '@/components/ui/PageLoader';

interface Props {
  roles?: string[];
}

export default function PrivateRoute({ roles }: Props) {
  const { isAuthenticated, user, accessToken, setAccessToken, logout } = useAuthStore();

  // On page refresh: isAuthenticated=true (persisted) but accessToken=null (not persisted).
  // We need to silently get a new token via the refresh cookie before rendering child routes.
  const [bootstrapping, setBootstrapping] = useState(isAuthenticated && !accessToken);

  useEffect(() => {
    if (!isAuthenticated || accessToken) {
      setBootstrapping(false);
      return;
    }
    axios
      .post('/api/auth/refresh', {}, { withCredentials: true })
      .then(({ data }) => setAccessToken(data.accessToken))
      .catch(() => logout())
      .finally(() => setBootstrapping(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
