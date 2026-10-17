import { Box, Typography } from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { useNavigate } from 'react-router-dom';
import { COLORS, LAYOUT } from '@/styles/tokens';
import { NAV_ITEMS, PATHS } from '@/router/paths';
import NavItem from './NavItem';
import { useAppStore } from '@/store/useAppStore';
import { apiMode } from '@/data/services/apiMode';

interface SidebarProps {
  /** 手机端抽屉模式下点击导航后应关闭抽屉 */
  onNavigate?: () => void;
}

/**
 * 侧栏内容（桌面固定 232px / 手机抽屉内复用同一套）。
 * 节点 2:1 区域。
 */
export default function Sidebar({ onNavigate }: SidebarProps) {
  const currentUser = useAppStore((state) => state.currentUser);
  const navigate = useNavigate();
  const live = apiMode() === 'live';

  // live 模式：审核台仅对管理员展示（后端也有权限门控，这里只是不暴露入口）
  const items = live && currentUser.role !== 'admin'
    ? NAV_ITEMS.filter((entry) => entry.path !== '/audit')
    : NAV_ITEMS;

  return (
    <Box
      className="flex flex-col"
      style={{
        width: LAYOUT.sidebarWidth,
        minWidth: LAYOUT.sidebarWidth,
        height: '100%',
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
            borderRadius: '10px',
            backgroundColor: COLORS.primary,
            color: '#fff',
            flexShrink: 0,
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
        {items.map((entry) => (
          <NavItem key={entry.label} entry={entry} onNavigate={onNavigate} />
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
            flexShrink: 0,
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

      {/* 账号设置入口（仅 live 模式，mock 无后端密码体系） */}
      {live && (
        <Box
          role="button"
          tabIndex={0}
          onClick={() => navigate(PATHS.SETTINGS)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(PATHS.SETTINGS);
          }}
          className="flex items-center gap-1.5"
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            color: COLORS.sub2,
            fontSize: 12,
            fontWeight: 600,
            border: `1px solid ${COLORS.line}`,
          }}
        >
          <SettingsOutlinedIcon style={{ fontSize: 15 }} />
          修改密码
        </Box>
      )}
    </Box>
  );
}
