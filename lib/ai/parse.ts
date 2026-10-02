import type { AIPlan } from '../types';
import { AIResponseSchema } from '../schema';
import { sanitizeSelector, sanitizeStyles } from '../css-sanitize';

const THINK_RE = /<(think|reasoning|thought)>[\s\S]*?<\/\1>/gi;
const TRUNCATED_HINT = '请到设置页调大「最大输出 tokens」后重试，或换个更简短的需求';

/** 从模型输出中提取 JSON（兼容 ```json 包裹、前后有废话、思考标签等情况） */
export function extractJson(text: string): unknown {
  let t = text.trim();
  if (/<(think|reasoning|thought)>/i.test(t)) {
    // 剥掉已闭合的思考段，以及结尾未闭合（被截断）的思考段
    t = t
      .replace(THINK_RE, '')
      .replace(/<(think|reasoning|thought)>[\s\S]*$/i, '')
      .trim();
    if (!t) throw new Error(`AI 只输出了思考内容没给出方案，多半是被截断。${TRUNCATED_HINT}`);
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) t = fence[1].trim();
  t = t.replace(/^[\uFEFF\u200b]+/, '');
  try {
    return JSON.parse(t);
  } catch {
    /* 走切片与修复 */
  }
  const s = t.indexOf('{');
  if (s < 0) throw new Error('AI 没有返回 JSON');
  try {
    return JSON.parse(t.slice(s, t.lastIndexOf('}') + 1));
  } catch {
    /* 走修复 */
  }
  return repairParse(t.slice(s));
}

interface CutPoint {
  pos: number;
  stack: string[];
}

const closer = (ch: string) => (ch === '{' ? '}' : ']');
const closeAll = (s: string, quote: string | null, stack: string[]) => {
  if (quote) s += '"'; // 开引号在输出里已归一化为 "，补上收尾引号
  for (let i = stack.length - 1; i >= 0; i--) s += closer(stack[i]!);
  return s;
};

/**
 * 修复模型常见的 JSON 瑕疵：注释、尾逗号、字符串里的真实换行、
 * 中文智能引号、以及输出被截断（回退到最后一个完整的逗号处再闭合）。
 */
function repairParse(raw: string): unknown {
  let out = '';
  const stack: string[] = [];
  const cutPoints: CutPoint[] = [];
  /** 当前字符串的“闭合引号”：普通 " 用 " 闭合，中文 “ 允许用 ” 闭合 */
  let quote: string | null = null;
  let esc = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (quote) {
      if (esc) {
        out += ch;
        esc = false;
      } else if (ch === '\\') {
        out += ch;
        esc = true;
      } else if (ch === quote) {
        out += '"';
        quote = null;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        /* \r\n 只留 \n */
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
      continue;
    }
    if (ch === '"' || ch === '\u201c') {
      out += '"';
      quote = ch === '"' ? '"' : '\u201d';
      continue;
    }
    if (ch === '/' && raw[i + 1] === '/') {
      while (i < raw.length && raw[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    if (ch === '/' && raw[i + 1] === '*') {
      i += 2;
      while (i < raw.length && !(raw[i] === '*' && raw[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
      out += ch;
      continue;
    }
    if (ch === '}' || ch === ']') {
      out = out.replace(/[\s,]+$/, ''); // 去掉尾逗号
      if (stack.length && closer(stack[stack.length - 1]!) === ch) stack.pop();
      out += ch;
      continue;
    }
    if (ch === ',') cutPoints.push({ pos: out.length, stack: [...stack] });
    out += ch;
  }

  // 没有未闭合结构，说明只是语法瑕疵（注释 / 尾逗号已修）
  if (!quote && !stack.length) {
    try {
      return JSON.parse(out);
    } catch {
      throw new Error('AI 返回的内容无法解析为 JSON，换个说法再试试？');
    }
  }

  // 输出被截断：先按原样闭合，不行就回退到最后几个安全逗号处再闭合
  const attempts = [closeAll(out, quote, stack)];
  for (let c = cutPoints.length - 1; c >= 0 && attempts.length < 8; c--) {
    attempts.push(closeAll(out.slice(0, cutPoints[c]!.pos), null, cutPoints[c]!.stack));
  }
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* 尝试下一个 */
    }
  }
  throw new Error(`AI 的方案 JSON 被截断了，可能不完整。${TRUNCATED_HINT}`);
}

export function parsePlan(text: string): AIPlan {
  let data: unknown;
  try {
    data = extractJson(text);
  } catch (e: any) {
    throw new Error(e?.message || 'AI 返回的内容不是有效的装修方案 JSON，换个说法再试试？');
  }
  const parsed = AIResponseSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length ? `${first.path.join('.')}：${first.message}` : first?.message;
    throw new Error(`AI 返回的方案结构不符合要求${where ? `（${where}）` : ''}`);
  }
  const d = parsed.data;
  const dropped: string[] = [];
  const rules: AIPlan['rules'] = [];
  for (const r of d.rules.slice(0, 60)) {
    if (!r.selector) continue; // 截断修复产生的残缺规则直接丢弃
    const selector = sanitizeSelector(r.selector);
    if (!selector) {
      dropped.push(`无效/不安全的选择器：${r.selector.slice(0, 60)}`);
      continue;
    }
    const s = sanitizeStyles(r.styles ?? {});
    dropped.push(...s.dropped.map((x) => `已拦截样式 ${x}`));
    if (!Object.keys(s.styles).length) continue;
    rules.push({ id: r.id || undefined, selector, styles: s.styles, note: r.note?.slice(0, 80) });
  }
  const explanation = Array.isArray(d.explanation)
    ? d.explanation
    : (d.explanation ?? '').split(/\n+/).map((x) => x.replace(/^[-*\d.、\s]+/, '').trim());
  return {
    name: d.name?.slice(0, 60) || 'AI 装修方案',
    explanation: explanation.filter(Boolean).slice(0, 10),
    rules,
    removeIds: d.removeIds ?? [],
    dropped,
  };
}
