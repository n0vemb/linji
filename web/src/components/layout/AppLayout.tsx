import { useState } from 'react';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import { Outlet } from 'react-router-dom';
import MenuOutlinedIcon from '@mui/icons-material/MenuOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { COLORS, LAYOUT, SPACING } from '@/styles/tokens';
import { useIsMobile } from '@/hooks/useBreakpoint';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import MobileTabBar from './MobileTabBar';
import ToastHost from '@/components/common/Toast';

/**
 * 应用布局壳 —— 移动优先。
 *
 * 桌面（≥768px）：232px 固定侧栏 + 64px 顶栏 + 内容区。
 * 手机（<768px）：
 *   - 侧栏收进抽屉（左滑/汉堡菜单唤出），不再挤压内容宽度；
 *   - 顶部为 52px 精简栏（汉堡 + 标题），只保留搜索等必要入口；
 *   - 底部固定标签栏承担主导航（拇指热区）；
 *   - 内容区左右边距收窄，并留出底部标签栏 + iPhone 安全区的空间，
 *     否则最后一张卡片会被标签栏盖住。
 */
export default function AppLayout() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <Box
      className="flex"
      style={{
        height: '100dvh', // dvh：移动端浏览器地址栏收起/展开时不会跳动
        backgroundColor: COLORS.canvas,
        overflow: 'hidden',
      }}
    >
      {/* 桌面固定侧栏 / 手机抽屉 */}
      {isMobile ? (
        <Drawer
          open={drawerOpen}
          onClose={closeDrawer}
          // 手机上左边缘右滑唤出抽屉
          anchor="left"
          PaperProps={{
            sx: {
              width: LAYOUT.sidebarWidth,
              borderRight: `1px solid ${COLORS.line}`,
              paddingTop: LAYOUT.safeAreaTop,
            },
          }}
        >
          <Sidebar onNavigate={closeDrawer} />
        </Drawer>
      ) : (
        <Box sx={{ display: 'contents' }}>
          <Sidebar />
        </Box>
      )}

      <Box
        className="flex flex-col flex-1"
        style={{ minWidth: 0, minHeight: 0 }}
      >
        {isMobile ? (
          <MobileHeader onOpenMenu={() => setDrawerOpen(true)} />
        ) : (
          <Topbar />
        )}

        <Box
          component="main"
          className="flex-1"
          style={{
            // 关键：用 overflow auto 独立滚动，顶部/底部栏固定
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            padding: SPACING.pagePaddingMobile,
            paddingTop: 12,
            // 手机端底部留出「标签栏 + 安全区」，否则内容被遮住
            paddingBottom: isMobile
              ? `calc(${LAYOUT.mobileTabBarHeight}px + ${LAYOUT.safeAreaBottom} + 16px)`
              : 28,
            backgroundColor: COLORS.canvas,
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {isMobile && <MobileTabBar />}
      <ToastHost />
    </Box>
  );
}

/** 手机端精简顶栏：汉堡菜单 + 品牌名（其余入口交给底部栏 / 页面内） */
function MobileHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <Box
      component="header"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: LAYOUT.mobileTopbarHeight,
        minHeight: LAYOUT.mobileTopbarHeight,
        paddingTop: LAYOUT.safeAreaTop,
        pl: '4px',
        pr: '12px',
        backgroundColor: COLORS.surface,
        borderBottom: `1px solid ${COLORS.line}`,
      }}
    >
      <IconButton
        onClick={onOpenMenu}
        aria-label="打开菜单"
        sx={{
          // 44×44 触摸目标
          width: 44,
          height: 44,
          color: COLORS.ink,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <MenuOutlinedIcon />
      </IconButton>

      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: '8px',
          backgroundColor: COLORS.primary,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <AutoAwesomeOutlinedIcon style={{ fontSize: 15 }} />
      </Box>

      <Typography sx={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>
        作品灵感库
      </Typography>
    </Box>
  );
}
