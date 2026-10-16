import { Box, Typography, Button } from '@mui/material';
import { COLORS } from '@/styles/tokens';
import { useAppStore } from '@/store/useAppStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import AuditPanel from '@/components/inspiration/AuditPanel';
import { MOCK_USERS } from '@/data/mock/users';

/**
 * 04 审核台（节点 2:353）。
 * 默认管理员视角：待审队列 + 审核面板（创作者体检摘要只读）+ 通过 / 驳回。
 * 通过 / 驳回仅切换内存状态（D2 Deferred，刷新重置）。
 */
export default function AuditPage() {
  const auditQueue = useAppStore((state) => state.auditQueue);
  const inspirations = useAppStore((state) => state.inspirations);
  const setCurrentUser = useAppStore((state) => state.setCurrentUser);
  const { currentUser, isAdmin } = useCurrentUser();

  const pendingCount = auditQueue.filter((a) => a.status === 'pending').length;

  return (
    <Box>
      <Box className="flex items-center justify-between" sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 22, fontWeight: 700, color: COLORS.ink }}>
            审核台
          </Typography>
          <Typography sx={{ fontSize: 13, color: COLORS.sub2, mt: 0.5 }}>
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
            sx={{ borderRadius: 2, borderColor: COLORS.line, color: COLORS.sub1 }}
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
            borderRadius: 1.5,
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
            borderRadius: 2,
          }}
        >
          暂无审核项
        </Box>
      ) : (
        <Box
          className="grid gap-4"
          sx={{ gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
        >
          {auditQueue.map((item) => (
            <AuditPanel
              key={item.id}
              auditItem={item}
              inspiration={inspirations.find(
                (i) => i.id === item.inspirationID
              )}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
