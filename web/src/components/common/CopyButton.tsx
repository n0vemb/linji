import IconButton from '@mui/material/IconButton';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { COLORS } from '@/styles/tokens';
import { useClipboard } from '@/hooks/useClipboard';

interface CopyButtonProps {
  /** 取待复制文本（点击时调用，避免闭包陈旧） */
  getText: () => string;
  /** 复制成功的 toast 文案，如「标题已复制」 */
  message: string;
  /** 悬浮提示 */
  title?: string;
  /** 图标大小 */
  size?: number;
}

/**
 * 复制图标按钮（MUI ContentCopy，描边深灰 #52525B，规避 ardot SVG 限制 §7.2 / §7.3）。
 * 点击写入剪贴板 + toast。stopPropagation 避免触发卡片跳转。
 */
export default function CopyButton({
  getText,
  message,
  title = '复制',
  size = 18,
}: CopyButtonProps) {
  const { copy } = useClipboard();
  return (
    <IconButton
      size="small"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        void copy(getText(), message);
      }}
      sx={{
        p: 0.5,
        color: COLORS.sub1, // 深灰描边，白卡片可见（开发文档 §6.1）
        '&:hover': { backgroundColor: 'rgba(82,82,91,0.08)' },
      }}
    >
      <ContentCopyOutlinedIcon style={{ fontSize: size, color: COLORS.sub1 }} />
    </IconButton>
  );
}
