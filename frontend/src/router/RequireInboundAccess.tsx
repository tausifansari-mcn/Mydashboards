import { Navigate, Outlet } from 'react-router-dom';
import { useProcessStore } from '@/store/processStore';
import PageLoader from '@/components/ui/PageLoader';

// The sidebar already hides the Inbound nav item for anyone without access (see Sidebar.tsx's
// hasInbound check), but that only stops navigation via the sidebar itself — landing on /inbound
// directly (a bookmark, browser back/forward, a stale link) rendered the page anyway, which then
// 403'd on every data request and showed an empty dashboard with error banners instead of taking
// the person somewhere they can actually use. This mirrors that same access check as a route guard.
export default function RequireInboundAccess() {
  const { loaded, isSuperAdmin, dashboardSlugs, hasAnyInboundAccess } = useProcessStore();

  // /processes/my and /dashboards/my are fetched once after login (see AppShell.tsx) — until that
  // resolves, `loaded` is false and we don't yet know whether this person has inbound access, so
  // wait rather than redirecting a legitimate inbound user away on a false negative.
  if (!loaded) return <PageLoader />;

  const hasInbound = isSuperAdmin || (dashboardSlugs.includes('inbound') && hasAnyInboundAccess());
  if (!hasInbound) return <Navigate to="/quality" replace />;

  return <Outlet />;
}
