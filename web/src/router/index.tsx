import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import PlazaPage from '@/pages/PlazaPage';
import DetailPage from '@/pages/DetailPage';
import UploadPage from '@/pages/UploadPage';
import AuditPage from '@/pages/AuditPage';
import MinePage from '@/pages/MinePage';
import HealthPage from '@/pages/HealthPage';
import FavoritesPage from '@/pages/FavoritesPage';
import { PATHS } from './paths';

/**
 * 路由表（React Router v6）。
 * AppLayout 作为父壳（侧栏 + 顶栏 + <Outlet/>），各页面作为子路由。
 * 详情 / 体检 / 编辑为动态参数路由。
 */
export default function AppRouter() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PlazaPage />} />
        <Route path={PATHS.PLAZA} element={<PlazaPage />} />
        <Route path="/inspiration/:id" element={<DetailPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/edit/:id" element={<UploadPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/mine" element={<MinePage />} />
        <Route path="/health/:id" element={<HealthPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="*" element={<Navigate to={PATHS.PLAZA} replace />} />
      </Route>
    </Routes>
  );
}
