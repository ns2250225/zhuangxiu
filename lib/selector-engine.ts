import { UI_TAG } from './decoration-engine';

const UNSTABLE_CLASS =
  /(^|[-_])[a-z0-9]*\d[a-z0-9]{4,}$|^css-|^sc-|^jsx-|^svelte-|^_|^ng-|^v-|^data-v|__[a-zA-Z0-9]{5,}$|^(is-|has-)?(active|hover|hovered|focus|focused|selected|open|opened|show|shown|visible|current|checked|disabled|loading|animat\w*)$|^pagestyler/i;

const esc = (s: string) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));

/** CSS 类型选择器里的标签名：SVG 元素大小写敏感（如 linearGradient），HTML 一律小写 */
const cssTag = (el: Element) =>
  el.namespaceURI === 'http://www.w3.org/2000/svg' ? el.tagName : el.tagName.toLowerCase();

export function stableClasses(el: Element, max = 3): string[] {
  return Array.from(el.classList)
    .filter((c) => c.length <= 40 && !UNSTABLE_CLASS.test(c))
    .slice(0, max);
}

function stableId(el: Element): string | null {
  const id = el.id;
  if (!id || id.length > 40 || /\d{3,}|^[0-9]|[:.]|^(ember|react|radix|mui|headlessui)/i.test(id)) return null;
  return id;
}

const isUnique = (sel: string, el: Element) => {
  try {
    const list = document.querySelectorAll(sel);
    return list.length === 1 && list[0] === el;
  } catch {
    return false;
  }
};

function segment(el: Element, withNth: boolean): string {
  const tag = cssTag(el);
  const id = stableId(el);
  if (id) return `#${esc(id)}`;
  let seg = tag + stableClasses(el, 2).map((c) => '.' + esc(c)).join('');
  if (withNth && el.parentElement) {
    const same = Array.from(el.parentElement.children).filter((c) => c.tagName === el.tagName);
    if (same.length > 1) seg += `:nth-of-type(${same.indexOf(el) + 1})`;
  }
  return seg;
}

/** 为元素生成尽量短且唯一的 CSS 选择器 */
export function uniqueSelector(el: Element): string {
  const tag = cssTag(el);
  if (tag === 'html' || tag === 'body' || tag === 'head') return tag;
  const id = stableId(el);
  if (id && isUnique(`#${esc(id)}`, el)) return `#${esc(id)}`;

  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName.toLowerCase() !== 'html') {
    const t = cur.tagName.toLowerCase();
    if (t === 'body') {
      parts.unshift('body');
      break;
    }
    const loose = segment(cur, false);
    const tryLoose = [loose, ...parts].join(' > ');
    if (isUnique(tryLoose, el)) return tryLoose;
    const strict = segment(cur, true);
    parts.unshift(strict);
    const sel = parts.join(' > ');
    if (isUnique(sel, el)) return sel;
    if (strict.startsWith('#')) break;
    // 链太长会超出校验长度上限，宁短勿废（UI 会显示实际命中数）
    if (parts.length >= 30) break;
    cur = cur.parentElement;
  }
  return parts.join(' > ');
}

/** 相似元素选择器：同标签 + 稳定类名；没有类名时退化为“父级 > 标签” */
export function similarSelector(el: Element): { selector: string; count: number } | null {
  const tag = cssTag(el);
  if (['html', 'body'].includes(tag)) return null;
  const classes = stableClasses(el, 3);
  const candidates: string[] = [];
  if (classes.length) {
    const first = esc(classes[0]!);
    candidates.push(tag + classes.map((c) => '.' + esc(c)).join(''));
    if (classes.length > 1) candidates.push(`${tag}.${first}`);
    candidates.push('.' + first);
  }
  const parent = el.parentElement;
  if (parent && parent.tagName.toLowerCase() !== 'html') {
    const ps = uniqueSelector(parent);
    candidates.push(`${ps} > ${tag}`);
    const gp = parent.parentElement;
    if (gp && gp.tagName.toLowerCase() !== 'html') {
      const pseg = cssTag(parent) + stableClasses(parent, 2).map((c) => '.' + esc(c)).join('');
      candidates.push(`${uniqueSelector(gp)} > ${pseg} > ${tag}`);
    }
  }
  for (const selector of candidates) {
    const count = countSafe(selector);
    if (count > 1 && count < 500) return { selector, count };
  }
  return null;
}

function countSafe(sel: string) {
  try {
    return document.querySelectorAll(sel).length;
  } catch {
    return 0;
  }
}

export function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = stableClasses(el, 2).map((c) => '.' + c).join('');
  return `${tag}${id}${cls}`;
}

export function textSnippet(el: Element, max = 40): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return '';
  const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

export const isOwnUi = (el: Element | null) => !!el && (el.tagName.toLowerCase() === UI_TAG || !!el.closest?.(UI_TAG));

/** 选择器能否被解析 */
export function isValidSelector(sel: string) {
  try {
    document.createDocumentFragment().querySelector(sel);
    return true;
  } catch {
    return false;
  }
}
