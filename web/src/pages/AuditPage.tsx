import { Box, Typography, Button } from '@mui/material';
import { COLORS, TOUCH } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useIsMobile } from '@/hooks/useBreakpoint';
import AuditPanel from '@/components/inspiration/AuditPanel';
import type { Inspiration } from '@/data/types';
import { MOCK_USERS } from '@/data/mock/users';

/**
 * 04 审核台（节点 2:353）。
 * 待审队列 + 审核面板（完整内容预览 + 创作者体检摘要只读）+ 通过 / 驳回（驳回必填理由）。
 * live 模式：队列与内嵌灵感来自后端；mock 模式：内存演示。
 */
export default function AuditPage() {
  const auditQueue = useAppStore((state) => state.auditQueue);
  const inspirations = useAppStore((state) => state.inspirations);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const { currentUser, isAdmin } = useCurrentUser();
  const isMobile = useIsMobile();

  const pendingCount = auditQueue.filter((a) => a.status === 'pending').length;

  return (
    <Box>
      <Box
        className={
          isMobile ? 'flex flex-col' : 'flex items-center justify-between'
        }
        sx={{ mb: 2, gap: isMobile ? 1.5 : 2 }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: isMobile ? 24 : 28,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: COLORS.ink,
            }}
          >
            审核台
          </Typography>
          <Typography sx={{ fontSize: isMobile ? 12 : 13, color: COLORS.sub2, mt: 0.5 }}>
            待审队列 {pendingCount} 项 · 创作者体检摘要只读
          </Typography>
        </Box>
        {!isAdmin && (
          <Button
            variant="outlined"
            size="small"
            onClick={() =>
              setCurrentUser(MOCK_USERS.find((u) => u.role === 'admin')!)
            }
            sx={{
              borderRadius: '999px',
              borderColor: COLORS.line,
              color: COLORS.sub1,
              px: 1.5,
              alignSelf: isMobile ? 'stretch' : undefined,
              minHeight: isMobile ? TOUCH.minTarget : undefined,
              transition: 'all .15s ease',
              '&:hover': { borderColor: COLORS.sub1, backgroundColor: COLORS.canvas },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            切换到管理员视角
          </Button>
        )}
      </Box>

      {!isAdmin && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: '14px',
            backgroundColor: 'rgba(245,158,11,0.12)',
            color: COLORS.status['warn-deep'],
            fontSize: 13,
          }}
        >
          当前为「{currentUser.name}（创作者）」视角。审核处置为管理员权限，可切换管理员演示。
        </Box>
      )}

      {auditQueue.length === 0 ? (
        <Box
          sx={{
            p: 6,
            textAlign: 'center',
            color: COLORS.sub3,
            border: `1px dashed ${COLORS.line}`,
            borderRadius: '14px',
          }}
        >
          暂无审核项
        </Box>
      ) : (
        // 审核面板现在内嵌素材预览（图片/视频）+ 标题/文案/话题，
        // 信息量大，单列纵向排列才能看全；双列会让素材被压得看不清。
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {auditQueue.map((item) => (
            <AuditPanel
              key={item.id}
              auditItem={item}
              // live 模式队列项内嵌完整灵感；mock 模式从 store 查找
              inspiration={
                (item as { inspiration?: Inspiration }).inspiration ??
                inspirations.find((i) => i.id === item.inspirationID)
              }
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
