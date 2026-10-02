import type { DecorationRule } from './types';
import { uid } from './utils';

export interface Preset {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  /** 用于预设卡片的色块 */
  swatch: string[];
  rules: Array<Pick<DecorationRule, 'selector' | 'styles'> & { note?: string }>;
}

/** 零优先级的“全部普通元素”选择器，后续规则可以轻松覆盖它 */
const ALL = ':where(body *:not(img, video, picture, canvas, svg, path, iframe, source))';
const BTN = 'button, [role="button"], input[type="submit"], input[type="button"], .btn, .button';
const CARD = 'article, [class*="card"], [class*="Card"]';
const FIELD = 'input:not([type="checkbox"]):not([type="radio"]), textarea, select';
const BARS = 'header, nav, [role="banner"], [role="navigation"]';

type PresetRule = Preset['rules'][number];

const darkBase = (bg: string, fg: string, border: string, link: string, surface: string, bar: string): PresetRule[] => [
  { selector: 'html, body', styles: { backgroundColor: bg, color: fg }, note: '主背景' },
  { selector: ALL, styles: { backgroundColor: 'transparent', color: fg, borderColor: border }, note: '统一元素底色' },
  { selector: 'a, a *', styles: { color: link }, note: '链接颜色' },
  { selector: 'h1, h2, h3, h4, h5, h6', styles: { color: '#ffffff' }, note: '标题' },
  { selector: `${BTN}, ${FIELD}`, styles: { backgroundColor: surface, color: fg, borderColor: border }, note: '按钮与输入框' },
  { selector: `${BARS}, footer, aside`, styles: { backgroundColor: bar }, note: '导航 / 侧栏' },
  { selector: 'pre, code, kbd, blockquote', styles: { backgroundColor: surface, color: fg }, note: '代码块' },
];

export const PRESETS: Preset[] = [
  {
    id: 'midnight',
    name: '午夜深色',
    emoji: '🌙',
    desc: '深蓝夜色，护眼又高级',
    swatch: ['#0f1117', '#1c2130', '#8ab4ff', '#e5e7eb'],
    rules: darkBase('#0f1117', '#e5e7eb', '#2a3040', '#8ab4ff', '#1c2130', '#141824'),
  },
  {
    id: 'reading',
    name: '专注阅读',
    emoji: '📖',
    desc: '暖纸色 + 衬线字体 + 宽松行距，隐藏干扰',
    swatch: ['#f8f4ea', '#3b3125', '#a0522d', '#e8dfca'],
    rules: [
      { selector: 'html, body', styles: { backgroundColor: '#f8f4ea', color: '#3b3125' }, note: '暖纸底色' },
      { selector: 'p, li, dd, blockquote', styles: { fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif', fontSize: '18px', lineHeight: '1.85', letterSpacing: '0.2px' }, note: '正文排版' },
      { selector: 'h1, h2, h3', styles: { fontFamily: 'Georgia, "Noto Serif SC", "Songti SC", serif', color: '#2a2118', lineHeight: '1.35' }, note: '标题' },
      { selector: 'a', styles: { color: '#a0522d', textDecoration: 'underline', textUnderlineOffset: '3px' }, note: '链接' },
      { selector: 'aside, [class*="advert"], [id*="advert"], [class*="ad-banner"], [class*="sponsor"], [class*="popup"], [class*="recommend"]', styles: { display: 'none' }, note: '隐藏侧栏与广告' },
      { selector: 'img', styles: { borderRadius: '6px' }, note: '图片' },
    ],
  },
  {
    id: 'glass',
    name: '玻璃拟态',
    emoji: '🫧',
    desc: '渐变底 + 毛玻璃卡片',
    swatch: ['#a18cd1', '#fbc2eb', '#ffffff', '#5b4b8a'],
    rules: [
      { selector: 'body', styles: { background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 50%, #8fd3f4 100%)', backgroundAttachment: 'fixed', color: '#2d2346' }, note: '渐变背景' },
      { selector: `${BARS}, footer, aside, ${CARD}, section`, styles: { backgroundColor: 'rgba(255,255,255,0.32)', backdropFilter: 'blur(14px) saturate(1.4)', border: '1px solid rgba(255,255,255,0.55)', borderRadius: '16px', boxShadow: '0 8px 32px rgba(45,35,70,0.15)' }, note: '毛玻璃卡片' },
      { selector: BTN, styles: { backgroundColor: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: '999px', color: '#2d2346' }, note: '按钮' },
      { selector: 'a', styles: { color: '#5b4b8a' }, note: '链接' },
    ],
  },
  {
    id: 'neo-brutal',
    name: 'Neo Brutalism',
    emoji: '🟨',
    desc: '粗黑边、硬阴影、高饱和撞色',
    swatch: ['#FFD84D', '#FF7AD9', '#59A7FF', '#111111'],
    rules: [
      { selector: 'body', styles: { backgroundColor: '#FFD84D', color: '#111111' }, note: '黄色主背景' },
      { selector: BARS, styles: { backgroundColor: '#FF7AD9', borderBottom: '4px solid #111111' }, note: '粉色导航栏' },
      { selector: BTN, styles: { backgroundColor: '#59A7FF', color: '#111111', border: '3px solid #111111', borderRadius: '8px', boxShadow: '4px 4px 0 #111111', fontWeight: '800' }, note: '按钮变狠' },
      { selector: CARD, styles: { backgroundColor: '#FFFFFF', border: '3px solid #111111', borderRadius: '10px', boxShadow: '6px 6px 0 #111111' }, note: '撞色卡片' },
      { selector: 'h1, h2, h3', styles: { fontWeight: '900', letterSpacing: '-0.5px', color: '#111111' }, note: '粗标题' },
      { selector: 'a', styles: { color: '#111111', textDecoration: 'underline', textDecorationColor: '#FF6B57', textDecorationThickness: '3px', fontWeight: '700' }, note: '链接' },
      { selector: FIELD, styles: { border: '3px solid #111111', borderRadius: '8px', backgroundColor: '#FFFFFF', boxShadow: '3px 3px 0 #111111' }, note: '输入框' },
      { selector: 'footer', styles: { backgroundColor: '#7DFF8A', borderTop: '4px solid #111111' }, note: '页脚' },
      { selector: 'img', styles: { border: '3px solid #111111', borderRadius: '8px' }, note: '图片描边' },
    ],
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    emoji: '🌆',
    desc: '霓虹紫青 + 等宽字体',
    swatch: ['#0a0014', '#ff2bd6', '#00f0ff', '#fcee0a'],
    rules: [
      ...darkBase('#0a0014', '#00f0ff', '#ff2bd6', '#ff2bd6', '#1a0030', '#12001f'),
      { selector: 'body, body *', styles: { fontFamily: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace' }, note: '等宽字体' },
      { selector: 'h1, h2, h3', styles: { color: '#fcee0a', textShadow: '0 0 8px #ff2bd6, 0 0 16px #ff2bd6', textTransform: 'uppercase' }, note: '霓虹标题' },
      { selector: BTN, styles: { border: '2px solid #00f0ff', boxShadow: '0 0 12px #00f0ff', color: '#00f0ff' }, note: '霓虹按钮' },
      { selector: 'img', styles: { filter: 'saturate(1.6) hue-rotate(-15deg)' }, note: '图片色调' },
    ],
  },
  {
    id: 'newspaper',
    name: '报纸模式',
    emoji: '📰',
    desc: '米黄纸张 + 黑白图片 + 衬线',
    swatch: ['#f4efe1', '#1a1a1a', '#8a8a8a', '#ffffff'],
    rules: [
      { selector: 'html, body', styles: { backgroundColor: '#f4efe1', color: '#1a1a1a' }, note: '纸张底色' },
      { selector: ALL, styles: { backgroundColor: 'transparent', color: '#1a1a1a', borderColor: '#1a1a1a' }, note: '去色' },
      { selector: 'body, body *', styles: { fontFamily: '"Times New Roman", Times, "Songti SC", "SimSun", serif' }, note: '衬线字体' },
      { selector: 'h1, h2', styles: { textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '3px double #1a1a1a', paddingBottom: '6px' }, note: '报头' },
      { selector: 'img, video', styles: { filter: 'grayscale(1) contrast(1.15)' }, note: '黑白图片' },
      { selector: 'a', styles: { textDecoration: 'underline', color: '#1a1a1a' }, note: '链接' },
    ],
  },
  {
    id: 'sakura',
    name: '樱花模式',
    emoji: '🌸',
    desc: '粉嫩樱花，软萌圆润',
    swatch: ['#fff0f5', '#ffc0d9', '#ff8fb8', '#5a3d4a'],
    rules: [
      { selector: 'html, body', styles: { backgroundColor: '#fff0f5', color: '#5a3d4a' }, note: '樱花底色' },
      { selector: BARS, styles: { backgroundColor: '#ffc0d9' }, note: '导航栏' },
      { selector: BTN, styles: { backgroundColor: '#ff8fb8', color: '#ffffff', borderRadius: '999px', border: 'none', boxShadow: '0 4px 0 #e0709a' }, note: '按钮' },
      { selector: CARD, styles: { backgroundColor: '#ffffff', borderRadius: '18px', border: '2px solid #ffd3e3' }, note: '卡片' },
      { selector: 'a', styles: { color: '#d6457a' }, note: '链接' },
      { selector: 'h1, h2, h3', styles: { color: '#d6457a' }, note: '标题' },
    ],
  },
  {
    id: 'eyecare',
    name: '柔和护眼',
    emoji: '🍃',
    desc: '豆沙绿底色，降低刺眼白',
    swatch: ['#c7edcc', '#b8e2be', '#2b3a2e', '#3c7a4a'],
    rules: [
      { selector: 'html, body', styles: { backgroundColor: '#c7edcc', color: '#2b3a2e' }, note: '护眼底色' },
      { selector: ALL, styles: { backgroundColor: 'transparent', color: '#2b3a2e' }, note: '去掉刺眼白底' },
      { selector: `${BARS}, footer, ${BTN}, ${FIELD}`, styles: { backgroundColor: '#b8e2be' }, note: '控件底色' },
      { selector: 'a', styles: { color: '#2f6b3f' }, note: '链接' },
      { selector: 'img, video', styles: { filter: 'brightness(0.92)' }, note: '图片降亮' },
    ],
  },
  {
    id: 'oled',
    name: 'OLED 黑',
    emoji: '⚫',
    desc: '纯黑省电，极致对比',
    swatch: ['#000000', '#111111', '#66ccff', '#dddddd'],
    rules: [
      ...darkBase('#000000', '#dddddd', '#222222', '#66ccff', '#0d0d0d', '#000000'),
      { selector: 'img, video', styles: { opacity: '0.85' }, note: '图片降亮' },
    ],
  },
  {
    id: 'pixel',
    name: '像素模式',
    emoji: '👾',
    desc: '复古掌机绿 + 方块像素',
    swatch: ['#e0f8cf', '#86c06c', '#306850', '#071821'],
    rules: [
      { selector: 'html, body', styles: { backgroundColor: '#e0f8cf', color: '#071821' }, note: '掌机屏幕' },
      { selector: ALL, styles: { borderRadius: '0', color: '#071821' }, note: '去圆角' },
      { selector: 'body, body *', styles: { fontFamily: '"Press Start 2P", "Courier New", monospace' }, note: '像素字体' },
      { selector: `${BTN}, ${CARD}, ${FIELD}`, styles: { backgroundColor: '#86c06c', border: '4px solid #071821', boxShadow: '4px 4px 0 #306850', borderRadius: '0' }, note: '像素方块' },
      { selector: BARS, styles: { backgroundColor: '#306850', color: '#e0f8cf' }, note: '导航栏' },
      { selector: 'img', styles: { imageRendering: 'pixelated', border: '4px solid #071821' }, note: '像素图片' },
    ],
  },
];

export function presetToRules(p: Preset, basePriority = 0): DecorationRule[] {
  return p.rules.map((r, i) => ({
    id: uid('pre'),
    selector: r.selector,
    styles: { ...r.styles },
    enabled: true,
    source: 'preset',
    priority: basePriority + i,
    note: r.note,
    presetId: p.id,
  }));
}
