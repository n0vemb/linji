import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, TextField, Typography } from '@mui/material';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { COLORS, LAYOUT, TOUCH } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useToastStore } from '@/components/common/Toast';
import { useIsMobile } from '@/hooks/useBreakpoint';

/**
 * 登录页（live 模式）。
 * 演示账号密码见种子数据（server/src/services/seed.ts）：
 *   管理员 admin / demo123（审核台）
 *   创作者 xu   / demo123（上传 / 我的灵感）
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const login = useAppStore((state) => state.login);
  const register = useAppStore((state) => state.register);
  const showToast = useToastStore((state) => state.show);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  // 已登录（如登录后手动跳转到 /login）直接回广场
  const authUser = useAppStore((state) => state.authUser);
  useEffect(() => {
    if (authUser) navigate('/', { replace: true });
  }, [authUser, navigate]);

  const handleSubmit = async () => {
    if (!username.trim() || !password) {
      showToast('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        showToast('登录成功');
      } else {
        await register(username.trim(), password, displayName.trim() || undefined);
        showToast('注册成功，已自动登录');
      }
      navigate('/', { replace: true });
    } catch (err) {
      showToast((err as Error).message || '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const fill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <Box
      className="flex items-center justify-center"
      sx={{
        minHeight: '100dvh',
        backgroundColor: COLORS.canvas,
        p: isMobile ? 2 : 3,
        pt: `calc(${LAYOUT.safeAreaTop} + 24px)`,
      }}
    >
      <Card
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 380,
          p: isMobile ? 2.5 : 3,
          borderRadius: '16px',
          border: `1px solid ${COLORS.line}`,
          backgroundColor: COLORS.surface,
        }}
      >
        <Typography
          sx={{
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.ink,
            letterSpacing: '-0.02em',
          }}
        >
          作品灵感库
        </Typography>
        <Typography sx={{ fontSize: 12, color: COLORS.sub2, mt: 0.5, mb: 2.5 }}>
          {mode === 'login' ? '登录后管理你的灵感' : '注册新账号（创作者）'}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="用户名"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ style: { fontSize: 16, minHeight: TOUCH.minTarget } }}
          />
          <TextField
            label="密码"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            size="small"
            inputProps={{ style: { fontSize: 16, minHeight: TOUCH.minTarget } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
          />
          {mode === 'register' && (
            <TextField
              label="昵称（选填）"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              size="small"
              inputProps={{ style: { fontSize: 16, minHeight: TOUCH.minTarget } }}
            />
          )}

          <Button
            variant="contained"
            fullWidth
            disabled={loading}
            startIcon={<LoginOutlinedIcon />}
            onClick={() => void handleSubmit()}
            sx={{
              borderRadius: '999px',
              minHeight: TOUCH.buttonHeight,
              mt: 0.5,
            }}
          >
            {loading ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
          </Button>

          <Button
            size="small"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            sx={{ color: COLORS.sub2, minHeight: 36 }}
          >
            {mode === 'login' ? '没有账号？注册一个' : '已有账号？去登录'}
          </Button>
        </Box>

        {/* 演示账号（本地 / 测试服便利入口） */}
        <Box
          sx={{
            mt: 2.5,
            p: 1.5,
            borderRadius: '10px',
            backgroundColor: COLORS.canvas,
            border: `1px dashed ${COLORS.line}`,
          }}
        >
          <Typography sx={{ fontSize: 11, color: COLORS.sub3, mb: 1 }}>
            演示账号（密码均为 demo123）
          </Typography>
          <Box className="flex flex-wrap gap-1.5">
            <Button size="small" variant="outlined" onClick={() => fill('admin', 'demo123')}
              sx={{ borderRadius: '999px', fontSize: 12, borderColor: COLORS.line, color: COLORS.sub1 }}>
              管理员 admin
            </Button>
            <Button size="small" variant="outlined" onClick={() => fill('xu', 'demo123')}
              sx={{ borderRadius: '999px', fontSize: 12, borderColor: COLORS.line, color: COLORS.sub1 }}>
              创作者 xu
            </Button>
          </Box>
        </Box>
      </Card>
    </Box>
  );
}
