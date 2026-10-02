export type RuleSource = 'ai' | 'manual' | 'preset' | 'import';

export interface DecorationRule {
  id: string;
  selector: string;
  styles: Record<string, string>;
  enabled: boolean;
  source: RuleSource;
  priority: number;
  /** 规则动作：默认改样式；'remove' 表示把命中元素从页面移除（可还原） */
  action?: 'remove';
  /** 可读说明，例如 “导航栏粉黄撞色” */
  note?: string;
  /** 来源于哪个预设（仅 preset 规则） */
  presetId?: string;
}

export interface SiteDecoration {
  id: string;
  name: string;
  host: string;
  /** "/*" 表示整站；否则为具体路径或带 * 的通配 */
  pathPattern: string;
  enabled: boolean;
  rules: DecorationRule[];
  createdAt: number;
  updatedAt: number;
}

export interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  /** 毫秒 */
  timeout: number;
}

export type MascotSkin = 'yellow' | 'pink' | 'blue' | 'green';
export type MascotForm = 'robot' | 'cat' | 'painter';
export type MascotState = 'idle' | 'thinking' | 'decorating' | 'success' | 'paused' | 'warning';

export interface Settings {
  mascotEnabled: boolean;
  mascotSkin: MascotSkin;
  mascotForm: MascotForm;
  mascotSize: number;
  panelSide: 'right' | 'left';
  /** 发送给 AI 前展示将要发送的内容类型 */
  confirmBeforeSend: boolean;
  /** 页面摘要中是否包含可见文本片段 */
  includeText: boolean;
  /** 本地保存 AI 对话记录 */
  saveChat: boolean;
}

export interface MascotPosition {
  side: 'left' | 'right';
  /** 距视口顶部的比例 0~1 */
  top: number;
  minimized: boolean;
}

export interface DecorationCodePayload {
  version: number;
  name: string;
  host: string;
  pathPattern: string;
  rules: DecorationRule[];
  createdAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  /** assistant 消息解析出的方案 */
  plan?: AIPlan;
  error?: boolean;
  at: number;
}

/** AI 返回、经过校验与清洗后的方案 */
export interface AIPlan {
  name: string;
  explanation: string[];
  /** 新增或更新（id 命中已有规则即为更新）的规则 */
  rules: Array<Pick<DecorationRule, 'selector' | 'styles'> & { id?: string; note?: string }>;
  /** 需要删除的已有规则 id */
  removeIds: string[];
  /** 被安全策略丢弃的条目说明 */
  dropped: string[];
}

export interface PageStatus {
  host: string;
  supported: boolean;
  decorated: boolean;
  paused: boolean;
  ruleCount: number;
  missCount: number;
  decorationNames: string[];
}
