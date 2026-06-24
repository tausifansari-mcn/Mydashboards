import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PrivateRoute from './PrivateRoute';
import AppShell from '@/components/layout/AppShell';
import PageLoader from '@/components/ui/PageLoader';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const DashboardLauncher = lazy(() => import('@/features/dashboard/DashboardLauncher'));
const ClientsPage = lazy(() => import('@/features/admin/ClientsPage'));
const UsersPage = lazy(() => import('@/features/admin/UsersPage'));
const ProcessesPage = lazy(() => import('@/features/admin/ProcessesPage'));
const AccessPage = lazy(() => import('@/features/admin/AccessPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const AuditPage = lazy(() => import('@/features/audit/AuditPage'));
const CallMasterDashboard = lazy(() => import('@/features/call-master/CallMasterDashboard'));

const wrap = (C: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <C />
  </Suspense>
);

const router = createBrowserRouter([
  { path: '/login', element: wrap(LoginPage) },
  { path: '/forgot-password', element: wrap(ForgotPasswordPage) },
  { path: '/reset-password/:token', element: wrap(ResetPasswordPage) },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/dashboard', element: wrap(DashboardLauncher) },
          { path: '/call-master', element: wrap(CallMasterDashboard) },
          { path: '/profile', element: wrap(ProfilePage) },
          {
            element: <PrivateRoute roles={['super_admin']} />,
            children: [
              { path: '/admin/clients', element: wrap(ClientsPage) },
              { path: '/admin/users', element: wrap(UsersPage) },
              { path: '/admin/processes', element: wrap(ProcessesPage) },
              { path: '/admin/access', element: wrap(AccessPage) },
              { path: '/audit', element: wrap(AuditPage) },
            ],
          },
        ],
      },
    ],
  },
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
