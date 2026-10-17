/**
 * 收藏 service（per-user 多对多）。
 * live：后端 favorites 表；mock：内存 Set（刷新重置，仅演示用）。
 */
import type { Inspiration } from '../types';
import { apiMode } from './apiMode';
import { api } from './apiClient';
import { MOCK_INSPIRATIONS } from '../mock/inspirations';

/** mock 模式的演示收藏（与后端种子的两条一致） */
const mockFavs = new Set<string>(
  MOCK_INSPIRATIONS.filter((i) => i.creatorID !== 'user_xu' && i.status === 'approved')
    .slice(0, 2)
    .map((i) => i.id)
);

const LIVE = (): boolean => apiMode() === 'live';

export async function toggleFavorite(id: string): Promise<boolean> {
  if (LIVE()) {
    const res = await api.post<{ isFavorite: boolean }>(
      `/inspirations/${id}/favorite`
    );
    return res.isFavorite;
  }
  if (mockFavs.has(id)) mockFavs.delete(id);
  else mockFavs.add(id);
  return mockFavs.has(id);
}

export async function fetchFavorites(): Promise<Inspiration[]> {
  if (LIVE()) {
    const res = await api.get<{ inspirations: Inspiration[] }>('/favorites');
    return res.inspirations;
  }
  return MOCK_INSPIRATIONS.filter((i) => mockFavs.has(i.id)).map((i) => ({
    ...i,
    isFavorite: true,
  }));
}

/** mock 模式：把内存收藏态映射到灵感列表上（live 模式由后端直接回填） */
export function applyMockFavorites(list: Inspiration[]): Inspiration[] {
  if (LIVE()) return list;
  return list.map((i) => ({ ...i, isFavorite: mockFavs.has(i.id) }));
}

/** mock 模式：某条是否已收藏 */
export function isMockFavorited(id: string): boolean {
  return mockFavs.has(id);
}
