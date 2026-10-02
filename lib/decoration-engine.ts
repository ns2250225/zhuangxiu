import type { DecorationRule } from './types';
import { kebab } from './utils';
import { sanitizeProp, sanitizeValue, stripPseudoElements } from './css-sanitize';

export const UI_TAG = 'pagestyler-ui';
const STYLE_ID = 'pagestyler-ai-decoration';

/** 按顶层逗号拆分选择器（忽略括号内的逗号） */
export function splitSelector(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const PSEUDO_TAIL = /(::?(before|after|first-line|first-letter|placeholder|selection|marker|backdrop|-webkit-[a-z-]+)(\([^)]*\))?)$/i;

/** 给选择器加上“不命中插件 UI 宿主”的保护 */
function guard(part: string) {
  const tail = part.match(PSEUDO_TAIL)?.[1] ?? '';
  const base = tail ? part.slice(0, -tail.length) : part;
  if (/^(html|body|:root)$/i.test(base.trim())) return part;
  return `${base}:not(${UI_TAG})${tail}`;
}

export function rulesToCss(rules: DecorationRule[]): string {
  const sorted = rules
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.enabled)
    .sort((a, b) => a.r.priority - b.r.priority || a.i - b.i);
  const blocks: string[] = [];
  for (const { r } of sorted) {
    const decls: string[] = [];
    for (const [p, v] of Object.entries(r.styles)) {
      const k = sanitizeProp(p);
      const val = sanitizeValue(v);
      if (k && val !== null) decls.push(`  ${kebab(k)}: ${val} !important;`);
    }
    if (!decls.length) continue;
    const sel = splitSelector(r.selector).map(guard).join(',\n');
    blocks.push(`/* ${r.id} · ${r.source} */\n${sel} {\n${decls.join('\n')}\n}`);
  }
  return blocks.join('\n\n');
}

/** 规则命中元素数量（排除插件自身） */
export function countMatches(selector: string): number {
  const s = stripPseudoElements(selector);
  if (!s) return 0;
  try {
    let n = 0;
    document.querySelectorAll(s).forEach((el) => {
      if (el.tagName.toLowerCase() !== UI_TAG) n++;
    });
    return n;
  } catch {
    return 0;
  }
}

interface RemovedRecord {
  el: Element;
  parent: Node;
  next: Node | null;
  ruleId: string;
}

const isProtected = (el: Element) =>
  el.tagName.toLowerCase() === UI_TAG ||
  !!el.closest?.(UI_TAG) ||
  ['html', 'body', 'head'].includes(el.tagName.toLowerCase());

/**
 * 页面级样式注入器：整个页面只维护一个 <style>，
 * 所有规则统一生成 CSS 注入，避免逐元素操作。
 * action === 'remove' 的规则例外：物理移除元素，并登记原位置以便还原。
 */
export class DecorationEngine {
  private el: HTMLStyleElement | null = null;
  private css = '';
  private observer: MutationObserver | null = null;
  private removeRules: DecorationRule[] = [];
  private removed: RemovedRecord[] = [];
  private removalTimer: ReturnType<typeof setTimeout> | undefined;

  render(rules: DecorationRule[] | null) {
    this.css = rules ? rulesToCss(rules) : '';
    this.removeRules = (rules ?? []).filter((r) => r.enabled && r.action === 'remove');
    this.ensure();
    this.applyRemovals();
  }

  private ensure() {
    if (!this.css) {
      this.el?.remove();
      this.el = null;
      return;
    }
    if (!this.el) {
      this.el = document.createElement('style');
      this.el.id = STYLE_ID;
      this.el.setAttribute('data-pagestyler', '');
    }
    if (this.el.textContent !== this.css) this.el.textContent = this.css;
    if (!this.el.isConnected) document.documentElement.appendChild(this.el);
    this.watch();
  }

  private watch() {
    if (this.observer) return;
    // 某些 SPA 会重写 <head>/<html>，样式被移除后自动补回；
    // 同时监听子树变化，让动态插入的命中元素再次被删除
    this.observer = new MutationObserver(() => {
      if (this.css && (!this.el || !this.el.isConnected)) this.ensure();
      if (this.removeRules.length) this.removalLater();
    });
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /** 移除 / 还原元素。规则被停用、撤销、预览取消时，对应元素自动放回原位 */
  private applyRemovals() {
    const activeIds = new Set(this.removeRules.map((r) => r.id));
    for (let i = this.removed.length - 1; i >= 0; i--) {
      const rec = this.removed[i]!;
      if (activeIds.has(rec.ruleId)) continue;
      try {
        rec.parent.insertBefore(rec.el, rec.next);
      } catch {
        /* 原位置已被页面重构销毁，放弃还原 */
      }
      this.removed.splice(i, 1);
    }
    if (!this.removeRules.length) return;
    for (const r of this.removeRules) {
      const sel = stripPseudoElements(r.selector);
      if (!sel) continue;
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (isProtected(el) || this.removed.some((rec) => rec.el === el)) return;
          const parent = el.parentNode;
          if (!parent) return;
          this.removed.push({ el, parent, next: el.nextSibling, ruleId: r.id });
          el.remove();
        });
      } catch {
        /* 非法选择器，跳过 */
      }
    }
  }

  private removalLater() {
    clearTimeout(this.removalTimer);
    this.removalTimer = setTimeout(() => this.applyRemovals(), 400);
  }

  /** remove 规则的实际命中数 = 已移除数 + 页面上待移除数 */
  countFor(rule: DecorationRule): number {
    const n = this.removed.filter((rec) => rec.ruleId === rule.id).length;
    return n + countMatches(rule.selector);
  }

  get currentCss() {
    return this.css;
  }

  destroy() {
    this.observer?.disconnect();
    this.observer = null;
    clearTimeout(this.removalTimer);
    this.removeRules = [];
    this.applyRemovals();
    this.el?.remove();
    this.el = null;
  }
}
