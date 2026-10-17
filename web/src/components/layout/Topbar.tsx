import { Box, Button, MenuItem, Select, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import FileCopyOutlinedIcon from '@mui/icons-material/FileCopyOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { useNavigate } from 'react-router-dom';
import { COLORS, LAYOUT } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import { apiMode } from '@/data/services/apiMode';
import {
  copyFullInspiration,
  type CopyResult,
} from '@/utils/clipboard';
import { PATHS } from '@/router/paths';
import type { CurrentUser } from '@/data/types';
import { MOCK_USERS } from '@/data/mock/users';

/**
 * 顶栏（64px）：右侧含「上传」入口、用户区（live = 当前用户 + 退出；
 * mock = 角色切换器）、「一键复制」全量按钮。
 * 一键复制仅当存在上下文灵感（详情页）时可用。
 */
export default function Topbar() {
  const navigate = useNavigate();
  const live = apiMode() === 'live';
  const currentUser = useAppStore((state) => state.currentUser);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const logout = useAppStore((state) => state.logout);
  const activeInspiration = useAppStore((state) => state.activeInspiration);
  const setActiveInspiration = useAppStore((state) => state.setActiveInspiration);
  const showToast = useToastStore((state) => state.show);

  const handleRoleChange = (user: CurrentUser) => {
    setCurrentUser(user);
    // 切换用户后清空详情上下文（避免越权上下文复用）
    setActiveInspiration(null);
  };

  const handleLogout = () => {
    logout();
    showToast('已退出登录');
  };

  const handleFullCopy = async () => {
    if (!activeInspiration) {
      showToast('请进入灵感详情后使用全量复制');
      return;
    }
    const result: CopyResult = await copyFullInspiration(activeInspiration);
    showToast(result.success ? '已复制全部内容' : '复制失败，请重试');
  };

  return (
    <Box
      className="flex items-center justify-between px-6"
      style={{
        height: LAYOUT.topbarHeight,
        minHeight: LAYOUT.topbarHeight,
        backgroundColor: COLORS.surface,
        borderBottom: `1px solid ${COLORS.line}`,
      }}
    >
      <Typography style={{ fontSize: 15, fontWeight: 600, color: COLORS.ink }}>
        作品灵感库
      </Typography>

      <Box className="flex items-center gap-3">
        {/* 上传入口 */}
        <Button
          variant="contained"
          startIcon={<AddOutlinedIcon style={{ fontSize: 18 }} />}
          onClick={() => navigate(PATHS.UPLOAD)}
          sx={{ borderRadius: '999px', height: 36, transition: 'all .15s ease', '&:active': { transform: 'scale(0.98)' } }}
        >
          上传灵感
        </Button>

        {/* 用户区 */}
        {live ? (
          <>
            <Typography sx={{ fontSize: 13, color: COLORS.sub1, whiteSpace: 'nowrap' }}>
              {currentUser.name}
              <Typography component="span" sx={{ fontSize: 11, color: COLORS.sub3, ml: 0.5 }}>
                （{currentUser.role === 'admin' ? '管理员' : '创作者'}）
              </Typography>
            </Typography>
            <Button
              variant="outlined"
              startIcon={<LogoutOutlinedIcon style={{ fontSize: 17 }} />}
              onClick={handleLogout}
              sx={{
                borderRadius: '999px',
                height: 36,
                borderColor: COLORS.line,
                color: COLORS.sub1,
                '&:active': { transform: 'scale(0.98)' },
              }}
            >
              退出
            </Button>
          </>
        ) : (
          /* 角色切换器（演示权限门控 / 审核台视角，mock 模式专用） */
          <Select
            size="small"
            value={currentUser.id}
            onChange={(e) => {
              const next = MOCK_USERS.find((u) => u.id === e.target.value);
              if (next) handleRoleChange(next);
            }}
            sx={{ height: 36, minWidth: 132, fontSize: 13 }}
          >
            {MOCK_USERS.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.name}（{u.role === 'admin' ? '管理员' : '创作者'}）
              </MenuItem>
            ))}
          </Select>
        )}

        {/* 一键复制（全量） */}
        <Button
          variant="outlined"
          startIcon={<FileCopyOutlinedIcon style={{ fontSize: 18 }} />}
          onClick={handleFullCopy}
          disabled={!activeInspiration}
          sx={{
            borderRadius: '999px',
            height: 36,
            borderColor: COLORS.line,
            color: activeInspiration ? COLORS.primary : COLORS.sub3,
            transition: 'all .15s ease',
            '&:hover': { borderColor: COLORS.primary, backgroundColor: 'rgba(59,130,246,0.06)' },
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          一键复制
        </Button>
      </Box>
    </Box>
  );
}
