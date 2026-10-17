import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { COLORS, TOUCH } from '@/styles/tokens';
import type { NavEntry } from '@/router/paths';

interface NavItemProps {
  entry: NavEntry;
  /** 点击后回调（手机端用于关闭抽屉） */
  onNavigate?: () => void;
}

/**
 * 侧栏导航项：基于 NavLink 高亮当前路由。
 * 当前项：主色蓝文字 + 浅蓝底；非当前：次级字。
 * 触摸目标高度 48px（≥ HIG 44px 下限），避免手滑点不中。
 */
export default function NavItem({ entry, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={entry.path}
      end={entry.exact}
      onClick={onNavigate}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <div
          className={clsx(
            'flex items-center px-3 rounded-lg text-sm font-medium transition-colors'
          )}
          style={{
            // 触摸目标不小于 44px
            minHeight: TOUCH.navItemHeight,
            color: isActive ? COLORS.primary : COLORS.sub1,
            backgroundColor: isActive
              ? 'rgba(59,130,246,0.10)'
              : 'transparent',
            // 移动端点击热区，禁止长按选中/高亮，更接近原生 App 手感
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'manipulation',
          }}
        >
          <span
            style={{
              width: 4,
              height: 16,
              borderRadius: '8px',
              marginRight: 10,
              backgroundColor: isActive ? COLORS.primary : 'transparent',
              flexShrink: 0,
            }}
          />
          {entry.label}
        </div>
      )}
    </NavLink>
  );
}
