import type { ComplianceLevel } from '../types';

/**
 * 合规规则引擎（可解释 · 低误判）。
 *
 * 设计原则（针对「最近」被当成「最」误杀的问题）：
 * 1. **不用裸单字子串匹配**。「最」「第一」单字直接匹配会命中「最近」「第一步」
 *    等完全正常的表达，误判率极高。
 * 2. **硬阻断只收高置信规则**：明确的引流 / 交易 / 资质伪造，这类几乎没有合法用法。
 * 3. **广告法极限词降级为风险提示**：「最便宜」「国家级」等在广告法语境下确实违规，
 *    但日常文案里大量存在（如「最便宜的方案」出现在教程里），直接硬阻断会
 *    把正常创作打死；改为 warn + 给出替换建议，由人判断。
 * 4. **白名单豁免**：命中词若处在明确的良性语境（如「最近」「第一步」
 *    「最想」「最爱」）则跳过。
 */

/** 规则命中的详情，供前端展示「为什么」+「怎么改」 */
export interface ComplianceHit {
  /** 命中的词（用于界面高亮） */
  word: string;
  /** 所属类别 */
  category: ComplianceCategory;
  /** 严重级别 */
  severity: 'block' | 'warn';
  /** 为什么会命中（可解释，不搞黑箱） */
  reason: string;
  /** 建议怎么改（仅 warn 级给出替换建议） */
  suggestion?: string;
}

export type ComplianceCategory =
  | 'diversion' // 站外引流
  | 'transaction' // 违规交易
  | 'false_claim' // 虚假资质 / 权威背书
  | 'absolute'; // 广告法极限词

interface Rule {
  word: string;
  category: ComplianceCategory;
  severity: 'block' | 'warn';
  reason: string;
  suggestion?: string;
}

/**
 * 硬阻断规则 —— 只收录「几乎没有合法创作用法」的强违规。
 * 每条都要求是**完整短语**而非裸单字，保证零误判。
 */
const BLOCK_RULES: Rule[] = [
  // 站外引流：小红书 / 抖音均明确禁止，创作文案里出现即为导流
  { word: '加微信', category: 'diversion', severity: 'block', reason: '站外引流，平台明确禁止' },
  { word: '加v信', category: 'diversion', severity: 'block', reason: '站外引流，平台明确禁止' },
  { word: 'vx', category: 'diversion', severity: 'block', reason: '疑似微信号引流缩写' },
  { word: 'v信', category: 'diversion', severity: 'block', reason: '疑似微信号引流缩写' },
  { word: '加我微信', category: 'diversion', severity: 'block', reason: '站外引流，平台明确禁止' },
  { word: '私信下单', category: 'diversion', severity: 'block', reason: '引导私信交易，平台明确禁止' },
  { word: '加群', category: 'diversion', severity: 'block', reason: '引导站外群组，平台明确禁止' },
  { word: '扫码', category: 'diversion', severity: 'block', reason: '引导扫码，疑似站外导流' },
  { word: '二维码', category: 'diversion', severity: 'block', reason: '引导二维码导流' },
  { word: '点击链接', category: 'diversion', severity: 'block', reason: '引导站外链接' },
  { word: '戳链接', category: 'diversion', severity: 'block', reason: '引导站外链接' },
  { word: '主页链接', category: 'diversion', severity: 'block', reason: '引导站外链接' },

  // 违规交易：绕过平台交易担保
  { word: '私下交易', category: 'transaction', severity: 'block', reason: '引导私下交易，绕过平台担保' },
  { word: '私下转账', category: 'transaction', severity: 'block', reason: '引导私下转账，绕过平台担保' },
  { word: '微信转账', category: 'transaction', severity: 'block', reason: '引导站外转账' },
  { word: '刷单', category: 'transaction', severity: 'block', reason: '刷单属违规交易' },
  { word: '代购', category: 'transaction', severity: 'block', reason: '代购交易需资质许可' },

  // 虚假资质 / 权威背书：无合法创作用法
  { word: '国家级', category: 'false_claim', severity: 'block', reason: '涉及虚假资质背书' },
  { word: '官方授权', category: 'false_claim', severity: 'block', reason: '涉及虚假授权背书，需资质证明' },
  { word: '官方指定', category: 'false_claim', severity: 'block', reason: '涉及虚假背书，需资质证明' },
  { word: '100%有效', category: 'false_claim', severity: 'block', reason: '绝对化效果承诺' },
];

/**
 * 广告法极限词 —— 降级为风险提示（warn），不硬阻断。
 * 必须写**完整词组**，绝不写裸「最」「第一」。
 */
const WARN_RULES: Rule[] = [
  { word: '最便宜', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「价格友好」「低预算」' },
  { word: '最低价', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「当前较低价位」' },
  { word: '最优惠', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「优惠力度大」' },
  { word: '最好', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「很不错」「很推荐」' },
  { word: '最佳', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「很适合」' },
  { word: '最强', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「效果很突出」' },
  { word: '第一品牌', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「leading 品牌」→「知名品牌」' },
  { word: '销量第一', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「销量领先」' },
  { word: '全网最低', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「近期好价」' },
  { word: '史上', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「少有」「罕见」' },
  { word: '绝无仅有', category: 'absolute', severity: 'warn', reason: '广告法极限用语', suggestion: '试试「比较少见」' },
];

/**
 * 良性语境白名单：见下方 `isWhitelisted`（按命中位置前后文判断，
 * 不用整段正则，避免「最」自身被白名单吃掉）。
 */

/** 规则命中位置（用于展示「在哪个字段」） */
export interface ComplianceResult {
  level: ComplianceLevel;
  hits: ComplianceHit[];
  /** 硬阻断原因（block 时非空）；warn 时为风险摘要 */
  blockingReason: string | null;
}

/** 字段级检查结果 */
export interface FieldCompliance {
  title: ComplianceResult;
  copy: ComplianceResult;
  tags: ComplianceResult;
}

const EMPTY: ComplianceResult = { level: 'pass', hits: [], blockingReason: null };

/**
 * 判断某词在某段文本中是否处于良性语境。
 * 白名单正则不含该词本身（如 /最(近|...)?/ 会匹配到裸「最」），
 * 故需先剥离白名单片段再判断，避免「最」自身被白名单吃掉。
 */
function isWhitelisted(text: string, index: number, word: string): boolean {
  const before = text.slice(Math.max(0, index - 6), index);
  const after = text.slice(index + word.length, index + word.length + 4);

  // 「最」类：向前看后续字符，落在良性词（近/新/终/后/爱/想/多/常/好…）则豁免
  for (const next of ['近', '新', '终', '后', '爱', '想', '多', '常', '久', '佳', '棒', '美', '多']) {
    if (after.startsWith(next)) return true;
  }
  // 「第」类：向后看是否「步/天/次/个…」
  for (const next of ['步', '天', '次', '点', '站', '轮', '篇', '集', '代', '手']) {
    if (after.startsWith(next)) return true;
  }
  // 前文出现「最近」「最终」「最后」「最大程度」等，直接豁免
  if (/最(近|新|终|后|大程度|大化)$/.test(before)) return true;
  if (/(近|最)$/.test(before) && word.startsWith('最')) return true;

  return false;
}

/** 在单个字段文本中跑一遍规则 */
export function checkField(text: string): ComplianceResult {
  if (!text) return EMPTY;
  const lower = text.toLowerCase();
  const hits: ComplianceHit[] = [];
  const seen = new Set<string>();

  const scan = (rules: Rule[]) => {
    for (const rule of rules) {
      if (seen.has(rule.word)) continue;
      const needle = rule.word.toLowerCase();
      let idx = lower.indexOf(needle);
      while (idx !== -1) {
        if (!isWhitelisted(text, idx, rule.word)) {
          seen.add(rule.word);
          hits.push({
            word: rule.word,
            category: rule.category,
            severity: rule.severity,
            reason: rule.reason,
            suggestion: rule.suggestion,
          });
          break;
        }
        idx = lower.indexOf(needle, idx + 1);
      }
    }
  };

  scan(BLOCK_RULES);
  scan(WARN_RULES);

  if (hits.length === 0) return EMPTY;

  const blocks = hits.filter((h) => h.severity === 'block');
  if (blocks.length > 0) {
    return {
      level: 'block',
      hits,
      blockingReason: `检测到${blocks
        .map((h) => `「${h.word}」（${h.reason}）`)
        .join('、')}，需修改后提交`,
    };
  }
  return {
    level: 'warn',
    hits,
    blockingReason: null,
  };
}

/** 汇总三个字段的合规结论：任一硬阻断 → block；否则任一 warn → warn */
export function checkCompliance(input: {
  title: string;
  copy: string;
  tags: string[];
}): FieldCompliance & { overall: ComplianceResult } {
  const title = checkField(input.title);
  const copy = checkField(input.copy);
  const tags = checkField(input.tags.join(' '));

  const allHits = [...title.hits, ...copy.hits, ...tags.hits];
  const blocks = allHits.filter((h) => h.severity === 'block');

  const overall: ComplianceResult =
    blocks.length > 0
      ? {
          level: 'block',
          hits: allHits,
          blockingReason: `检测到${blocks
            .map((h) => `「${h.word}」（${h.reason}）`)
            .join('、')}，需修改后提交`,
        }
      : allHits.length > 0
        ? {
            level: 'warn',
            hits: allHits,
            blockingReason: null,
          }
        : EMPTY;

  return { title, copy, tags, overall };
}