import type { HealthReport } from '../types';
import { generateReport, type ScoreInput } from '../health/scorer';

/**
 * 体检 service 层（全 Promise 化）。
 * 上传即生成报告（generateReport 为本地启发式，稳定非随机）。
 */

const delay = (ms = 200): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** 生成体检报告（Promise 化，便于后续替换为服务端模型） */
export async function buildReport(input: ScoreInput): Promise<HealthReport> {
  await delay();
  return generateReport(input);
}
