interface SaveToPhoneBtnProps {
  onClick: () => void;
  label?: string;
}

/**
 * 「保存到手机」文字按钮（开发文档 §6.2 / §7.2）。
 * 半透明黑底 opacity .62、圆角 8、字号 12。用于视频浮层与封面叠加入口，
 * 不依赖 SVG 矢量图标。
 */
export default function SaveToPhoneBtn({
  onClick,
  label = '保存到手机',
}: SaveToPhoneBtnProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        backgroundColor: 'rgba(0,0,0,0.62)',
        color: '#FFFFFF',
        borderRadius: '8px',
        fontSize: 12,
        lineHeight: 1.4,
        padding: '4px 10px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 500,
      }}
    >
      {label}
    </button>
  );
}
