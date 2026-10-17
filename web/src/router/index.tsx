import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import AppLayout from '@/components/layout/AppLayout';
import PlazaPage from '@/pages/PlazaPage';
import DetailPage from '@/pages/DetailPage';
import UploadPage from '@/pages/UploadPage';
import AuditPage from '@/pages/AuditPage';
import MinePage from '@/pages/MinePage';
import HealthPage from '@/pages/HealthPage';
import FavoritesPage from '@/pages/FavoritesPage';
import SettingsPage from '@/pages/SettingsPage';
import LoginPage from '@/pages/LoginPage';
import { useAppStore } from '@/store/useAppStore';
import { COLORS } from '@/styles/tokens';
import { PATHS } from './paths';

/**
 * 路由表（React Router v6）。
 * BrowserRouter 在 main.tsx（ThemeProvider 内层），这里只放 Routes。
 * AppLayout 作为父壳（侧栏 + 顶栏 + <Outlet/>），各页面作为子路由。
 * live 模式未登录时，除 /login 外一律重定向到登录页。
 */

/** 登录态守卫：live 模式未登录 → /login */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const authReady = useAppStore((state) => state.authReady);
  const authUser = useAppStore((state) => state.authUser);
  const location = useLocation();

  if (!authReady) {
    // 登录态恢复中：空白等待（避免刷新页面时闪登录页）
    return <Box sx={{ minHeight: '100dvh', backgroundColor: COLORS.canvas }} />;
  }
  if (!authUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route index element={<PlazaPage />} />
        <Route path={PATHS.PLAZA} element={<PlazaPage />} />
        <Route path="/inspiration/:id" element={<DetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/edit/:id" element={<UploadPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/mine" element={<MinePage />} />
        <Route path="/health/:id" element={<HealthPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path={PATHS.SETTINGS} element={<SettingsPage />} />
        <Route path="*" element={<Navigate to={PATHS.PLAZA} replace />} />
      </Route>
    </Routes>
  );
}
