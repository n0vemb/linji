import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import { COLORS, LAYOUT } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { apiMode } from '@/data/services/apiMode';

/**
 * 底部标签栏（仅手机端 < 768px）。
 *
 * 为什么需要：桌面侧栏在手机上要吃掉 ~60% 宽度，且入口在屏幕顶部
 * —— 单手握持时拇指够不到，是移动端可用性的经典硬伤。
 *
 * 间距与状态规格（对齐 iOS Tab Bar / Material Navigation Bar）：
 * - 栏高 56px（含 iPhone home indicator 安全区）
 * - 图标槽位 24×24，所有 tab 图标**同尺寸同基线**，避免大小不一显得歪
 * - 图标 ↔ 文字 3px（视觉紧凑但不粘连）
 * - 文字 10px / 行高 1，选中 600、未选中 400（靠字重而非字号表达状态）
 * - 选中态：图标填色 + 文字主色 + 顶部 2px 主色指示条
 * - 离边：左右各留安全边距，图标区不贴边
 */

interface TabItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  /** 主行动点（实心药丸，始终主色） */
  primary?: boolean;
}

const TABS: TabItem[] = [
  {
    label: '广场',
    path: '/',
    icon: <GridViewOutlinedIcon />,
  },
  {
    label: '我的灵感',
    path: '/mine',
    icon: <FolderOutlinedIcon />,
  },
  {
    label: '上传',
    path: '/upload',
    icon: <AddCircleOutlineIcon />,
    primary: true,
  },
  {
    label: '审核台',
    path: '/audit',
    icon: <FactCheckOutlinedIcon />,
  },
];

/** 统一的图标槽位尺寸：所有图标锁死同一盒子，视觉才整齐 */
const ICON_SLOT = 24;
/** 图文间距 */
const GAP = 3;

export default function MobileTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAppStore((state) => state.currentUser);
  const live = apiMode() === 'live';

  // live 模式：审核台仅对管理员展示（与侧栏一致）
  const tabs = live && currentUser.role !== 'admin'
    ? TABS.filter((t) => t.path !== '/audit')
    : TABS;

  /** 判断是否激活：首页精确匹配，其他前缀匹配 */
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <Box
      component="nav"
      aria-label="主导航"
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'stretch',
        // 选中指示条贴顶，所以内容整体下移一点做视觉居中。
        // 注意：必须用显式 px 字符串 —— sx 里的数字会被主题 spacing(8) 乘大
        // （paddingTop: 3 实际 = 24px，会把文字挤出栏外）。
        paddingTop: '3px',
        height: `calc(${LAYOUT.mobileTabBarHeight}px + ${LAYOUT.safeAreaBottom})`,
        paddingBottom: LAYOUT.safeAreaBottom,
        backgroundColor: COLORS.surface,
        borderTop: `1px solid ${COLORS.line}`,
        // 浮层允许投影（内容从其下方滚过，需要明确分层）
        boxShadow: '0 -1px 8px rgba(0,0,0,0.04)',
      }}
    >
      {tabs.map((tab) => {
        const active = isActive(tab.path);

        // 颜色：主行动点恒为主色；普通项选中主色、未选中次级灰
        const color = tab.primary
          ? COLORS.primary
          : active
            ? COLORS.primary
            : COLORS.sub3;

        return (
          <Box
            component="button"
            type="button"
            key={tab.path}
            onClick={() => navigate(tab.path)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            sx={{
              position: 'relative',
              flex: 1,
              minWidth: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              // 图文间距（不用 gap 属性，直接用 margin，行为更可控）
              padding: '4px 6px 0',
              color,
              WebkitTapHighlightColor: 'transparent',
              touchAction: 'manipulation',
              transition: 'color .18s ease',

              // 顶部选中指示条：未选中时透明占位，避免高度跳动
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -3,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 18,
                height: 2,
                borderRadius: '999px',
                backgroundColor: tab.primary ? 'transparent' : COLORS.primary,
                opacity: active && !tab.primary ? 1 : 0,
                transition: 'opacity .18s ease',
              },

              '&:active': { opacity: 0.55 },
            }}
          >
            {/* 图标槽位：固定 24×24，所有 tab 对齐 */}
            <Box
              sx={{
                width: ICON_SLOT,
                height: ICON_SLOT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                // 主行动点：实心药丸底，尺寸与普通图标槽视觉平衡
                ...(tab.primary
                  ? {
                      width: 38,
                      height: 24,
                      borderRadius: '999px',
                      backgroundColor: COLORS.primary,
                      color: '#fff',
                    }
                  : {}),
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  '& svg': { fontSize: tab.primary ? 17 : ICON_SLOT },
                }}
              >
                {tab.icon}
              </Box>
            </Box>

            {/* 文字：与图标间距 GAP，选中加粗 */}
            <Typography
              sx={{
                marginTop: `${GAP}px`,
                fontSize: 10,
                lineHeight: 1,
                fontWeight: active || tab.primary ? 600 : 400,
                color,
                whiteSpace: 'nowrap',
                // 文字不换行、溢出隐藏，避免「我的灵感」挤压布局
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {tab.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
