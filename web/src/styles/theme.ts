import { createTheme } from '@mui/material/styles';
import { COLORS, FONTS } from './tokens';

/**
 * MUI 主题：palette / typography 映射开发文档 §4 token。
 * 组件内部样式用 sx 引用主题色，避免硬编码。
 */
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: COLORS.primary },
    background: {
      default: COLORS.canvas, // 画布底 #FAFAFA
      paper: COLORS.surface, // 卡片 #FFFFFF
    },
    text: {
      primary: COLORS.ink, // 深字 #0A0A0B
      secondary: COLORS.sub1, // 次级字 #52525B
      disabled: COLORS.sub3,
    },
    divider: COLORS.line, // 描边 #E4E4E7
  },
  typography: {
    fontFamily: FONTS.sans,
    // 中文 Noto Sans SC / 数字英文 Inter
    h1: { fontSize: 28, fontWeight: 700 },
    h2: { fontSize: 22, fontWeight: 700 },
    h3: { fontSize: 18, fontWeight: 600 },
    h4: { fontSize: 16, fontWeight: 600 },
    body1: { fontSize: 14, lineHeight: 1.6 },
    body2: { fontSize: 13, lineHeight: 1.5 },
    caption: { fontSize: 12 },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600 },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: `1px solid ${COLORS.line}`, borderRadius: 12 },
      },
    },
  },
});

export default theme;
