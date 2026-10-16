import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ToastHost from '@/components/common/Toast';

/**
 * 应用布局壳：左侧 232px 侧栏 + 右侧 64px 顶栏 + 内容区（<Outlet/>）。
 * 节点 2:1 区域整体结构。
 */
export default function AppLayout() {
  return (
    <Box className="flex" style={{ height: '100vh', backgroundColor: '#FAFAFA' }}>
      <Sidebar />
      <Box className="flex flex-col flex-1" style={{ minWidth: 0 }}>
        <Topbar />
        <Box
          className="flex-1 overflow-auto"
          style={{ padding: 28, backgroundColor: '#FAFAFA' }}
        >
          <Outlet />
        </Box>
      </Box>
      <ToastHost />
    </Box>
  );
}
