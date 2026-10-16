import { create } from 'zustand';
import { Snackbar, Alert } from '@mui/material';

/** 轻量 toast store（全局复制 / 保存成功提示，MUI Snackbar 封装） */
interface ToastState {
  message: string | null;
  show: (message: string) => void;
  hide: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  hide: () => set({ message: null }),
}));

/** 全局 toast 宿主（挂在 AppLayout 上，整站共用一个） */
export default function ToastHost() {
  const message = useToastStore((state) => state.message);
  const hide = useToastStore((state) => state.hide);

  return (
    <Snackbar
      open={!!message}
      autoHideDuration={1800}
      onClose={hide}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        severity="success"
        variant="filled"
        onClose={hide}
        sx={{ fontWeight: 600 }}
      >
        {message ?? ''}
      </Alert>
    </Snackbar>
  );
}
