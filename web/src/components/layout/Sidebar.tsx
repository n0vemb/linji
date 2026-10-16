import { Box, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { COLORS, LAYOUT } from '@/styles/tokens';
import { NAV_ITEMS } from '@/router/paths';
import NavItem from './NavItem';
import { useAppStore } from '@/store/useAppStore';

/**
 * 侧栏（232px 固定）：Logo + 工作区分组 + 导航 + 弹性留白 + 用户卡。
 * 节点 2:1 区域。
 */
export default function Sidebar() {
  const currentUser = useAppStore((state) => state.currentUser);

  return (
    <Box
      className="flex flex-col"
      style={{
        width: LAYOUT.sidebarWidth,
        minWidth: LAYOUT.sidebarWidth,
        height: '100vh',
        backgroundColor: COLORS.surface,
        borderRight: `1px solid ${COLORS.line}`,
        padding: '20px 16px',
      }}
    >
      {/* Logo */}
      <Box className="flex items-center gap-2" style={{ marginBottom: 28 }}>
        <Box
          className="flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            backgroundColor: COLORS.primary,
            color: '#fff',
          }}
        >
          <AutoAwesomeOutlinedIcon style={{ fontSize: 20 }} />
        </Box>
        <Box>
          <Typography style={{ fontWeight: 700, fontSize: 16, color: COLORS.ink, lineHeight: 1.1 }}>
            LinJi·灵集
          </Typography>
          <Typography style={{ fontSize: 11, color: COLORS.sub3, lineHeight: 1.2 }}>
            创作者灵感库
          </Typography>
        </Box>
      </Box>

      {/* 工作区分组 */}
      <Typography
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: COLORS.sub3,
          letterSpacing: 1,
          margin: '4px 8px 8px',
        }}
      >
        工作区
      </Typography>

      {/* 导航（固定顺序） */}
      <Box className="flex flex-col gap-1">
        {NAV_ITEMS.map((entry) => (
          <NavItem key={entry.label} entry={entry} />
        ))}
      </Box>

      {/* 弹性留白 */}
      <Box style={{ flex: 1 }} />

      {/* 用户卡 */}
      <Box
        className="flex items-center gap-2"
        style={{
          borderTop: `1px solid ${COLORS.line}`,
          paddingTop: 14,
        }}
      >
        <Box
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            backgroundColor: 'rgba(59,130,246,0.12)',
            color: COLORS.primary,
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {currentUser.name.slice(0, 1)}
        </Box>
        <Box className="flex-1" style={{ minWidth: 0 }}>
          <Typography style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }} noWrap>
            {currentUser.name}
          </Typography>
          <Typography style={{ fontSize: 11, color: COLORS.sub3 }}>
            {currentUser.role === 'admin' ? '管理员' : '创作者'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
