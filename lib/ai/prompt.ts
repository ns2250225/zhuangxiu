import type { DecorationRule } from '../types';

export const SYSTEM_PROMPT = `你是「PageStyler AI 网页装修师」。你的唯一工作是根据用户需求，为当前网页设计“装修方案”。
你只能输出一个 JSON 对象（不要 Markdown、不要代码块、不要任何额外文字），格式如下：
{
  "name": "方案名称（简短）",
  "explanation": ["给用户看的中文说明，每条一句话，3~6 条"],
  "rules": [
    { "id": "可选：如果是修改已有规则，填已有规则的 id", "selector": "CSS 选择器", "styles": { "backgroundColor": "#FFD84D" }, "note": "这条规则做什么（简短）" }
  ],
  "removeIds": ["可选：需要删除的已有规则 id"]
}

硬性约束：
1. 只能输出样式，styles 的 key 为 camelCase 的 CSS 属性，value 为字符串。
2. 禁止任何 JavaScript、<script>、事件属性、expression()、javascript: 链接、@import、外部 url()；只允许 data:image 内联图片。
3. 不要读取或修改 Cookie、LocalStorage、表单值，不要改变页面业务逻辑。
4. 选择器必须基于“页面结构摘要”或“选中元素”中真实存在的标签/类名/id，优先使用稳定、通用的类名，避免过长的 nth-child 链。
5. 若用户选中了元素，只装修这些元素（及其内部），不要改动整个页面。
6. 隐藏元素用 { "display": "none" }。
7. 规则数量控制在 1~25 条，保证颜色对比度可读。
8. 多轮修改时：在已有方案基础上增量调整——修改已有规则请带上其 id，删除用 removeIds，新增规则不要带 id。
9. 输出必须是严格合法的 JSON：不要注释、不要尾逗号、key 和 value 都用英文双引号、字符串值里不要有真实换行（需要换行用空格代替）。`;

export interface PromptContext {
  request: string;
  pageSummary: string;
  elementsSummary?: string;
  /** 当前页面已保存并生效的规则 */
  savedRules: DecorationRule[];
  /** 当前正在预览、尚未采用的方案规则（多轮修改时） */
  draftRules?: Array<{ id?: string; selector: string; styles: Record<string, string> }>;
  /** 智能修复模式：失效的规则 */
  brokenRules?: DecorationRule[];
}

const compactRules = (rules: Array<{ id?: string; selector: string; styles: Record<string, string> }>) =>
  rules
    .slice(0, 60)
    .map((r) => JSON.stringify({ id: r.id, selector: r.selector, styles: r.styles }))
    .join('\n');

export function buildUserPrompt(ctx: PromptContext): string {
  const parts = [`## 页面结构摘要\n${ctx.pageSummary}`];
  if (ctx.elementsSummary) parts.push(`## 用户选中的元素（只装修它们）\n${ctx.elementsSummary}`);
  if (ctx.savedRules.length) parts.push(`## 页面已生效的规则\n${compactRules(ctx.savedRules)}`);
  if (ctx.draftRules?.length) parts.push(`## 正在预览的方案（请在此基础上修改）\n${compactRules(ctx.draftRules)}`);
  if (ctx.brokenRules?.length)
    parts.push(
      `## 以下规则在页面上已经找不到目标元素（网页可能改版）\n${compactRules(ctx.brokenRules)}\n请根据最新页面结构为它们找到新的选择器：用相同的 id 返回修复后的规则，保留原有样式意图；实在无法对应的放进 removeIds。`,
    );
  parts.push(`## 用户需求\n${ctx.request}`);
  return parts.join('\n\n');
}
