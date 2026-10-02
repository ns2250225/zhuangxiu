import { describeElement, isOwnUi, stableClasses, textSnippet, uniqueSelector } from './selector-engine';

const SKIP = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'svg', 'path', 'iframe', 'canvas', 'video', 'audio', 'source', 'br', 'hr', 'wbr']);
const LANDMARK = new Set(['header', 'nav', 'main', 'aside', 'footer', 'section', 'article', 'form', 'h1', 'h2', 'h3', 'button', 'table', 'ul', 'ol']);

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return false;
  const cs = getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
}

function line(el: Element, depth: number, includeText: boolean) {
  const r = el.getBoundingClientRect();
  let s = `${'  '.repeat(depth)}${describeElement(el)} [${Math.round(r.width)}x${Math.round(r.height)}]`;
  const role = el.getAttribute('role');
  if (role) s += ` role=${role}`;
  if (includeText && el.children.length === 0) {
    const t = textSnippet(el, 30);
    if (t) s += ` "${t}"`;
  }
  return s;
}

/** 页面结构摘要：只包含标签/类名/尺寸/少量可见文本，不包含输入值、Cookie、存储等 */
export function buildPageSummary(opts: { includeText: boolean; maxNodes?: number }) {
  const maxNodes = opts.maxNodes ?? 160;
  const lines: string[] = [];
  let count = 0;

  const walk = (el: Element, depth: number) => {
    if (count >= maxNodes || depth > 7) return;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || isOwnUi(el)) return;
    if (el instanceof HTMLInputElement && el.type === 'password') return;
    if (!visible(el)) return;
    const interesting =
      LANDMARK.has(tag) || el.id || stableClasses(el).length > 0 || el.children.length > 1 || depth < 2;
    if (interesting) {
      lines.push(line(el, depth, opts.includeText));
      count++;
    }
    const kids = Array.from(el.children);
    // 同类兄弟过多时只取前几个，避免列表撑爆摘要
    const seen = new Map<string, number>();
    for (const k of kids) {
      const key = describeElement(k);
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n === 4) {
        lines.push(`${'  '.repeat(depth + 1)}…(更多 ${key})`);
        continue;
      }
      if (n > 4) continue;
      walk(k, interesting ? depth + 1 : depth);
    }
  };
  walk(document.body, 0);

  // 高频类名，便于 AI 选择通用选择器
  const freq = new Map<string, number>();
  document.body.querySelectorAll('[class]').forEach((el) => {
    if (isOwnUi(el)) return;
    for (const c of stableClasses(el, 4)) freq.set(c, (freq.get(c) ?? 0) + 1);
  });
  const topClasses = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([c, n]) => `.${c}(${n})`)
    .join(' ');

  const bs = getComputedStyle(document.body);
  return [
    `URL: ${location.origin}${location.pathname}`,
    `标题: ${document.title.slice(0, 80)}`,
    `当前配色: body 背景 ${bs.backgroundColor}, 文字 ${bs.color}, 字体 ${bs.fontFamily.slice(0, 80)}`,
    `高频类名: ${topClasses || '无'}`,
    '页面结构:',
    ...lines,
  ].join('\n');
}

/** 选中元素的局部结构摘要 */
export function buildElementsSummary(els: Element[], includeText: boolean) {
  return els
    .slice(0, 12)
    .map((el, i) => {
      const sel = uniqueSelector(el);
      const cs = getComputedStyle(el);
      const kids = Array.from(el.children)
        .slice(0, 8)
        .map((k) => '    ' + describeElement(k) + (includeText ? ` "${textSnippet(k, 24)}"` : ''))
        .join('\n');
      return [
        `#${i + 1} 选择器: ${sel}`,
        `  元素: ${describeElement(el)}${includeText ? ` 文本: "${textSnippet(el, 50)}"` : ''}`,
        `  当前样式: bg ${cs.backgroundColor}; color ${cs.color}; border ${cs.border}; radius ${cs.borderRadius}; font ${cs.fontSize} ${cs.fontWeight}`,
        kids ? `  子元素:\n${kids}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');
}
