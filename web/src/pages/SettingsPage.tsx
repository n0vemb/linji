import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  TextField,
  Button,
  IconButton,
  InputAdornment,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import { useNavigate } from 'react-router-dom';
import { COLORS, TOUCH } from '@/styles/tokens';
import { useToastStore } from '@/components/common/Toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import * as authSvc from '@/data/services/authService';

/**
 * 账号设置（节点新增 /settings）。
 * 当前唯一能力：修改密码（live 模式需校验原密码）。mock 模式无后端，禁用并提示。
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser } = useCurrentUser();
  const showToast = useToastStore((state) => state.show);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!oldPwd || !newPwd || !confirmPwd) {
      showToast('请填写全部字段');
      return;
    }
    if (newPwd.length < 6) {
      showToast('新密码至少 6 位');
      return;
    }
    if (newPwd !== confirmPwd) {
      showToast('两次输入的新密码不一致');
      return;
    }
    setBusy(true);
    try {
      await authSvc.changePassword(oldPwd, newPwd);
      showToast('密码已修改，请牢记新密码');
      setOldPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      const msg = (err as { message?: string }).message;
      showToast(msg ?? '修改失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto' }}>
      <Box className="flex items-center gap-2" sx={{ mb: 3 }}>
        <IconButton
          onClick={() => navigate(-1)}
          aria-label="返回"
          sx={{ color: COLORS.sub2 }}
        >
          <ArrowBackOutlinedIcon />
        </IconButton>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 800, color: COLORS.ink, letterSpacing: '-0.02em' }}>
            账号设置
          </Typography>
          <Typography sx={{ fontSize: 13, color: COLORS.sub2, mt: 0.5 }}>
            {currentUser.name} · 修改登录密码
          </Typography>
        </Box>
      </Box>

      <Card elevation={0} sx={{ p: 3, borderRadius: '14px', border: `1px solid ${COLORS.line}` }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, mb: 0.5 }}>
          修改密码
        </Typography>
        <Typography sx={{ fontSize: 12, color: COLORS.sub3, mb: 2.5 }}>
          出于安全考虑，修改密码需先验证原密码。新密码至少 6 位。
        </Typography>

        <Box className="flex flex-col gap-2.5">
          <TextField
            label="原密码"
            type={showOld ? 'text' : 'password'}
            value={oldPwd}
            onChange={(e) => setOldPwd(e.target.value)}
            fullWidth
            size="small"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowOld((v) => !v)} edge="end" size="small">
                    {showOld ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="新密码"
            type={showNew ? 'text' : 'password'}
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            fullWidth
            size="small"
            helperText="至少 6 位"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNew((v) => !v)} edge="end" size="small">
                    {showNew ? <VisibilityOffOutlinedIcon fontSize="small" /> : <VisibilityOutlinedIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="确认新密码"
            type={showNew ? 'text' : 'password'}
            value={confirmPwd}
            onChange={(e) => setConfirmPwd(e.target.value)}
            fullWidth
            size="small"
          />

          <Button
            variant="contained"
            onClick={submit}
            disabled={busy}
            sx={{
              mt: 1,
              borderRadius: '999px',
              minHeight: TOUCH.minTarget,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {busy ? '提交中…' : '保存修改'}
          </Button>
        </Box>
      </Card>
    </Box>
  );
}
