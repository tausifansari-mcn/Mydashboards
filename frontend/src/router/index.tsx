import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PrivateRoute from './PrivateRoute';
import AppShell from '@/components/layout/AppShell';
import PageLoader from '@/components/ui/PageLoader';

const LoginPage               = lazy(() => import('@/features/auth/LoginPage'));
const ForgotPasswordPage      = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage       = lazy(() => import('@/features/auth/ResetPasswordPage'));
const DashboardLauncher       = lazy(() => import('@/features/dashboard/DashboardLauncher'));
const ClientsPage             = lazy(() => import('@/features/admin/ClientsPage'));
const UsersPage               = lazy(() => import('@/features/admin/UsersPage'));
const ProcessesPage           = lazy(() => import('@/features/admin/ProcessesPage'));
const AccessPage              = lazy(() => import('@/features/admin/AccessPage'));
const ProfilePage             = lazy(() => import('@/features/profile/ProfilePage'));
const AuditPage               = lazy(() => import('@/features/audit/AuditPage'));
const SalesDashboard          = lazy(() => import('@/features/sales/SalesDashboard'));
const AIQualityDashboard           = lazy(() => import('@/features/ai-quality/AIQualityDashboard'));
const ProcessQualityDashboard      = lazy(() => import('@/features/ai-quality/ProcessQualityDashboard'));
const InboundQualityDashboard      = lazy(() => import('@/features/ai-quality/InboundQualityDashboard'));
const InboundDashboard        = lazy(() => import('@/features/inbound/InboundDashboard'));
const InboundProjectDashboard = lazy(() => import('@/features/inbound/InboundProjectDashboard'));

const wrap = (C: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <C />
  </Suspense>
);

const router = createBrowserRouter(
  [
    { path: '/login',                  element: wrap(LoginPage) },
    { path: '/forgot-password',        element: wrap(ForgotPasswordPage) },
    { path: '/reset-password/:token',  element: wrap(ResetPasswordPage) },
    {
      element: <PrivateRoute />,
      children: [
        {
          element: <AppShell />,
          children: [
            { path: '/dashboard',           element: wrap(DashboardLauncher) },
            { path: '/sales',               element: wrap(SalesDashboard) },
            { path: '/quality',                        element: wrap(AIQualityDashboard) },
            { path: '/quality/inbound/:clientId',      element: wrap(InboundQualityDashboard) },
            { path: '/quality/:clientId',              element: wrap(ProcessQualityDashboard) },
            { path: '/inbound',             element: wrap(InboundDashboard) },
            { path: '/inbound/:projectKey', element: wrap(InboundProjectDashboard) },
            { path: '/profile',             element: wrap(ProfilePage) },
            {
              element: <PrivateRoute roles={['super_admin']} />,
              children: [
                { path: '/admin/clients',   element: wrap(ClientsPage) },
                { path: '/admin/users',     element: wrap(UsersPage) },
                { path: '/admin/processes', element: wrap(ProcessesPage) },
                { path: '/admin/access',    element: wrap(AccessPage) },
                { path: '/audit',           element: wrap(AuditPage) },
              ],
            },
          ],
        },
      ],
    },
    { path: '/',  element: <Navigate to="/dashboard" replace /> },
    { path: '*',  element: <Navigate to="/dashboard" replace /> },
  ]
);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
