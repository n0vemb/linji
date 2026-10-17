/** ID 生成：可读前缀 + 时间 base36 + 随机后缀（撞库概率可忽略） */
export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
