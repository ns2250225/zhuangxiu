import { camel, kebab } from './utils';

/**
 * 装修规则的安全闸门：AI / 导入的规则只允许是“样式”，
 * 任何可能执行脚本、加载外部资源或逃逸出声明块的内容都会被丢弃。
 */
const BLOCKED_PROPS = new Set(['behavior', '-moz-binding', 'binding', '-ms-behavior']);
const PROP_RE = /^(--[a-zA-Z0-9-_]+|-?[a-z][a-z-]*)$/;
const BAD_VALUE = /(expression\s*\(|javascript:|vbscript:|@import|<\/?\w|[{};]|\\[0-9a-f]{1,6})/i;
const URL_RE = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
// 注意：`>` 是合法的子代组合器，不能拦；语法错误交给 querySelector 兜底
const BAD_SELECTOR = /[{};<@]|\/\*|\*\//;

export function sanitizeValue(value: unknown): string | null {
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string') return null;
  let v = value.trim().replace(/\s*!important\s*$/i, '');
  if (!v || v.length > 600) return null;
  if (BAD_VALUE.test(v)) return null;
  // 只允许内联 data:image 图片（不允许外部请求，防止追踪 / 泄露）
  let ok = true;
  v.replace(URL_RE, (_m, _q, u: string) => {
    if (!/^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i.test(u.trim())) ok = false;
    return '';
  });
  if (!ok) return null;
  if (/url\(/i.test(v) && !/url\(\s*['"]?data:image\//i.test(v)) return null;
  // 括号必须配对
  let depth = 0;
  for (const ch of v) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return null;
  }
  return depth === 0 ? v : null;
}

export function sanitizeProp(prop: unknown): string | null {
  if (typeof prop !== 'string') return null;
  const k = kebab(prop.trim());
  if (!PROP_RE.test(k) || BLOCKED_PROPS.has(k)) return null;
  return k;
}

/** 返回 camelCase key 的干净样式表，以及被丢弃的条目 */
export function sanitizeStyles(styles: Record<string, unknown>): {
  styles: Record<string, string>;
  dropped: string[];
} {
  const out: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [p, val] of Object.entries(styles ?? {})) {
    const k = sanitizeProp(p);
    const v = sanitizeValue(val);
    if (!k || v === null) {
      dropped.push(`${p}: ${String(val).slice(0, 60)}`);
      continue;
    }
    out[camel(k)] = v;
  }
  return { styles: out, dropped };
}

export function sanitizeSelector(sel: unknown): string | null {
  if (typeof sel !== 'string') return null;
  const s = sel.trim();
  if (!s || s.length > 800 || BAD_SELECTOR.test(s)) return null;
  // 不允许装修插件自身
  if (/pagestyler-ui/i.test(s)) return null;
  if (typeof document !== 'undefined') {
    try {
      document.createDocumentFragment().querySelector(stripPseudoElements(s) || '*');
    } catch {
      return null;
    }
  }
  return s;
}

/** 去掉 ::before 等伪元素，以便 querySelectorAll 统计命中 */
export function stripPseudoElements(sel: string) {
  return sel
    .split(',')
    .map((s) => s.replace(/::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|-webkit-[a-z-]+)(\([^)]*\))?/gi, '').trim())
    .map((s) => s.replace(/:(hover|focus|active|visited|focus-visible|focus-within)/gi, '').trim())
    .filter(Boolean)
    .join(', ');
}
