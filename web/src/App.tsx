import { useEffect } from 'react';
import AppRouter from '@/router';
import { useAppStore } from '@/store/useAppStore';

/**
 * 应用根组件：初始化 mock 数据（从 service 层载入 store），并渲染路由表。
 * Zustand 无需 Provider 嵌套。
 */
export default function App() {
  const init = useAppStore((state) => state.init);
  const initialized = useAppStore((state) => state.initialized);

  useEffect(() => {
    if (!initialized) {
      void init();
    }
  }, [init, initialized]);

  return <AppRouter />;
}
