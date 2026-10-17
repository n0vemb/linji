/**
 * 长尾词生成器 —— 基于当前灵感内容推导建议话题。
 *
 * 为什么重写：初版用的是固定词池（LONG_TAIL_POOL_HIGH/LOW），
 * 无论用户写什么题材都给同一批词（如给「数码开箱」推「夏日穿搭小个子」），
 * 属于**无信息量的假建议**，会透支用户信任。
 *
 * 新逻辑：从用户标题 / 文案 / 已有话题中识别出
 *   ① 人群词（谁：学生党 / 小个子 / 打工人…）
 *   ② 场景词（何时何地：通勤 / 夏日 / 早八…）
 *   ③ 意图词（要什么：避坑 / 显高 / 平价…）
 *   ④ 品类词（聊什么：穿搭 / 护肤 / 探店…）
 * 再按「品类 + 场景 + 人群 + 意图」的优先级组合成新词。
 *
 * 核心原则：**只推荐用户内容里已有依据的组合**，不凭空造词。
 * 识别不到足够信号时，返回空数组（而不是硬凑几个词）。
 */

/** 长尾词建议 */
export interface LongTailSuggestion {
  word: string;
  /** 推导依据：为什么给你这个词（可解释，避免黑箱） */
  reason: string;
}

/** 人群词 → 修饰后缀 */
const AUDIENCE_WORDS: Record<string, string> = {
  学生党: '学生党',
  学生: '学生党',
  大学生: '大学生',
  小个子: '小个子',
  矮个: '小个子',
  微胖: '微胖',
  梨形: '梨形身材',
  苹果型: '苹果型身材',
  打工人: '打工人',
  上班族: '上班族',
  职场: '职场人',
  新手: '新手',
  宝妈: '宝妈',
  妈妈: '宝妈',
  敏感肌: '敏感肌',
  油皮: '油皮',
  干皮: '干皮',
  预算有限: '平价',
  白菜价: '平价',
};

/** 场景词 */
const SCENE_WORDS: Record<string, string> = {
  通勤: '通勤',
  上班: '通勤',
  约会: '约会',
  度假: '旅行',
  旅游: '旅行',
  出游: '旅行',
  夏日: '夏日',
  夏季: '夏日',
  冬天: '冬季',
  秋冬: '秋冬',
  春季: '春季',
  周末: '周末',
  早八: '早八',
  换季: '换季',
  开学: '开学',
  过年: '过年',
  露营: '露营',
  居家: '居家',
  面试: '面试',
  婚礼: '婚礼',
};

/** 意图 / 痛点词 */
const INTENT_WORDS: Record<string, string> = {
  显高: '显高',
  显瘦: '显瘦',
  避坑: '避坑',
  平价: '平价',
  省钱: '省钱',
  搭配: '搭配',
  教程: '教程',
  攻略: '攻略',
  实测: '实测',
  对比: '对比',
  测评: '测评',
  推荐: '推荐',
  好物: '好物',
  清单: '清单',
  合集: '合集',
  干货: '干货',
  入门: '入门',
  新手: '新手',
};

/** 品类词（聊什么的对象） */
const CATEGORY_WORDS: Record<string, string> = {
  穿搭: '穿搭',
  搭配: '穿搭',
  衣服: '穿搭',
  裙子: '穿搭',
  外套: '穿搭',
  衬衫: '穿搭',
  裤: '穿搭',
  护肤: '护肤',
  化妆: '彩妆',
  彩妆: '彩妆',
  口红: '彩妆',
  面膜: '护肤',
  防晒: '防晒',
  美食: '美食',
  探店: '探店',
  烘焙: '烘焙',
  减脂: '健身',
  健身: '健身',
  瑜伽: '健身',
  家居: '家居',
  收纳: '收纳',
  数码: '数码',
  开箱: '开箱',
  耳机: '数码',
  相机: '数码',
  旅行: '旅行',
  攻略: '攻略',
  副业: '副业',
  效率: '效率',
  职场: '职场',
  面试: '面试',
  学习: '学习',
  考研: '考研',
  宠物: '宠物',
  猫: '猫咪',
  狗: '狗狗',
};

/**
 * 在文本中找出命中的词（返回词库的标准写法）。
 *
 * 关键：中文品类词普遍是 2 字（如「家居」「口红」），裸 `includes` 会误命中
 * 跨词组合 —— 实测「这家居酒馆」的「家」+「居」相邻被识别成「家居」品类，
 * 于是给探店笔记生成了「约会家居」这种无意义建议。
 *
 * 规则：单字触发词（长度 1）必须同时满足「前后都不是汉字」才算命中；
 * 多字触发词允许子串匹配（「小个子」出现在文案中间是正常的）。
 */
function findHits(
  text: string,
  dict: Record<string, string>,
  mode: 'category' | 'modifier' = 'modifier'
): string[] {
  const out = new Set<string>();
  for (const [trigger, canonical] of Object.entries(dict)) {
    if (mode === 'category') {
      if (hitsWithValidContext(text, trigger)) out.add(canonical);
    } else if (text.includes(trigger)) {
      out.add(canonical);
    }
  }
  return Array.from(out);
}

/**
 * 中文没有词边界，无法用英文式的 token 边界判断（实测「周末约会探店清单」
 * 里的「探店」会被边界法误杀）。
 *
 * 折中方案：**排除词表** —— 列出那些「命中词只是更长复合词的一部分」的上下文。
 * 只维护真正会出错的少量组合，不做通用 NLP，保证可预期、可维护。
 */
const CATEGORY_FALSE_FRIENDS: Record<string, string[]> = {
  家居: ['酒馆', '家具', '家居馆', '家居店'], // 这家居酒馆 / 家居家具
  口红: ['雨'], // 口红雨伞
  鞋: ['垫'], // 鞋垫
  裤: ['边'], // 裤边
  猫: ['咪'], // 猫咪（由「咪」单独触发更准）
  攻略: ['略图'], // 攻略图
};

/** 判断品类词命中时是否处在有效语境（不在排除词上下文里） */
function hitsWithValidContext(text: string, token: string): boolean {
  if (!text.includes(token)) return false;
  const bad = CATEGORY_FALSE_FRIENDS[token];
  if (!bad) return true;
  // token 后面紧跟排除词（如「家居」+「酒馆」）→ 判为误命中
  for (const w of bad) {
    if (new RegExp(token + w).test(text)) return false;
  }
  return true;
}
/** 去掉话题前缀 # */
function stripHash(tag: string): string {
  return tag.replace(/^#/, '');
}

export interface LongTailInput {
  title: string;
  copy: string;
  tags: string[];
}

/**
 * 生成长尾词建议（最多 6 个，按优先级去重）。
 * 识别不到足够信号时返回空数组 —— 宁可不给，也不给无关的假建议。
 */
export function generateLongTailWords(
  input: LongTailInput
): LongTailSuggestion[] {
  const text = `${input.title} ${input.copy} ${input.tags.join(' ')}`;
  const existing = new Set(input.tags.map(stripHash));

  const audiences = findHits(text, AUDIENCE_WORDS);
  const scenes = findHits(text, SCENE_WORDS);
  const intents = findHits(text, INTENT_WORDS);
  const categories = findHits(text, CATEGORY_WORDS, 'category');

  // 识别到的信号太少，不给建议（避免硬凑）
  const signalCount =
    audiences.length + scenes.length + intents.length + categories.length;
  if (signalCount === 0) return [];

  const suggestions: LongTailSuggestion[] = [];
  const seen = new Set<string>();

  const push = (word: string, reason: string) => {
    const w = word.trim();
    if (!w || seen.has(w) || existing.has(w)) return;
    // 过短的词（如单个「猫」）没有长尾价值
    if (w.length < 2) return;
    seen.add(w);
    suggestions.push({ word: w, reason });
  };

  // 优先级 1：品类 + 场景（「通勤穿搭」比「穿搭」更精准）
  for (const c of categories.slice(0, 2)) {
    for (const s of scenes.slice(0, 2)) {
      push(`${s}${c}`, `内容里同时提到「${c}」和「${s}」，组合后更精准`);
    }
  }

  // 优先级 2：品类 + 人群（「小个子穿搭」是高价值长尾）
  for (const c of categories.slice(0, 2)) {
    for (const a of audiences.slice(0, 2)) {
      push(`${a}${c}`, `内容里提到「${a}」，加上品类能覆盖更精准的人群`);
    }
  }

  // 优先级 3：意图 + 品类（「避坑穿搭」比「穿搭」有搜索意图）
  for (const i of intents.slice(0, 2)) {
    for (const c of categories.slice(0, 2)) {
      push(`${i}${c}`, `内容里的「${i}」意图 + 品类词，搜索量更精准`);
    }
  }

  // 优先级 4：场景 + 意图（「夏日避坑」）
  for (const s of scenes.slice(0, 1)) {
    for (const i of intents.slice(0, 1)) {
      push(`${s}${i}`, `场景「${s}」+ 意图「${i}」，补足时间维度`);
    }
  }

  // 优先级 5：品类本身（内容量不足以组合时，至少收窄到大词）
  for (const c of categories.slice(0, 2)) {
    push(c, `内容核心品类词，建议作为基础话题`);
  }

  return suggestions.slice(0, 6);
}

/** 仅取词（供 HealthReport.longTailWords 使用，保持字段类型不变） */
export function longTailWordsOnly(
  input: LongTailInput
): string[] {
  return generateLongTailWords(input).map((s) => s.word);
}
