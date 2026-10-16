import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { COLORS, LAYOUT } from '@/styles/tokens';
import type { NavEntry } from '@/router/paths';

interface NavItemProps {
  entry: NavEntry;
}

/**
 * 侧栏导航项：基于 NavLink 高亮当前路由。
 * 当前项：主色蓝文字 + 浅蓝底；非当前：次级字。
 */
export default function NavItem({ entry }: NavItemProps) {
  return (
    <NavLink
      to={entry.path}
      end={entry.exact}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <div
          className={clsx(
            'flex items-center px-3 h-10 rounded-lg text-sm font-medium transition-colors'
          )}
          style={{
            color: isActive ? COLORS.primary : COLORS.sub1,
            backgroundColor: isActive
              ? 'rgba(59,130,246,0.10)'
              : 'transparent',
          }}
        >
          <span
            style={{
              width: 4,
              height: 16,
              borderRadius: 2,
              marginRight: 10,
              backgroundColor: isActive ? COLORS.primary : 'transparent',
            }}
          />
          {entry.label}
        </div>
      )}
    </NavLink>
  );
}

export { LAYOUT };
