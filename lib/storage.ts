import { storage } from 'wxt/utils/storage';
import { browser } from 'wxt/browser';
import type { AIConfig, ChatMessage, MascotPosition, SiteDecoration, Settings } from './types';

export const DEFAULT_AI: AIConfig = {
  apiUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.4,
  maxTokens: 4000,
  timeout: 60000,
};

export const DEFAULT_SETTINGS: Settings = {
  mascotEnabled: true,
  mascotSkin: 'yellow',
  mascotForm: 'robot',
  mascotSize: 72,
  panelSide: 'right',
  confirmBeforeSend: false,
  includeText: true,
  saveChat: true,
};

export const aiConfigItem = storage.defineItem<AIConfig>('local:aiConfig', { fallback: DEFAULT_AI });
export const settingsItem = storage.defineItem<Settings>('local:settings', { fallback: DEFAULT_SETTINGS });
/** 暂停装修（显示原样）的站点；只停用不删除 */
export const pausedHostsItem = storage.defineItem<string[]>('local:pausedHosts', { fallback: [] });
/** 隐藏吉祥物的站点 */
export const mascotHiddenHostsItem = storage.defineItem<string[]>('local:mascotHiddenHosts', { fallback: [] });
export const mascotPosItem = storage.defineItem<MascotPosition>('local:mascotPos', {
  fallback: { side: 'right', top: 0.78, minimized: false },
});

const decoKey = (host: string) => `local:deco:${host}` as const;
const chatKey = (host: string) => `local:chat:${host}` as const;

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...(await settingsItem.getValue()) };
}
export async function getAIConfig(): Promise<AIConfig> {
  return { ...DEFAULT_AI, ...(await aiConfigItem.getValue()) };
}

export async function getDecorations(host: string): Promise<SiteDecoration[]> {
  return (await storage.getItem<SiteDecoration[]>(decoKey(host))) ?? [];
}
export async function setDecorations(host: string, list: SiteDecoration[]) {
  // 必须转成纯 JSON：Vue 的响应式 Proxy 会被 chrome.storage 序列化成普通对象
  if (list.length) await storage.setItem(decoKey(host), JSON.parse(JSON.stringify(list)));
  else await storage.removeItem(decoKey(host));
}
export function watchDecorations(host: string, cb: (list: SiteDecoration[]) => void) {
  return storage.watch<SiteDecoration[]>(decoKey(host), (v) => cb(v ?? []));
}

export async function getChat(host: string): Promise<ChatMessage[]> {
  return (await storage.getItem<ChatMessage[]>(chatKey(host))) ?? [];
}
export async function setChat(host: string, msgs: ChatMessage[]) {
  if (msgs.length) await storage.setItem(chatKey(host), JSON.parse(JSON.stringify(msgs.slice(-40))));
  else await storage.removeItem(chatKey(host));
}

export async function togglePaused(host: string, paused?: boolean) {
  const list = await pausedHostsItem.getValue();
  const now = paused ?? !list.includes(host);
  const next = list.filter((h) => h !== host);
  if (now) next.push(host);
  await pausedHostsItem.setValue(next);
  return now;
}

export async function setMascotHidden(host: string, hidden: boolean) {
  const list = (await mascotHiddenHostsItem.getValue()).filter((h) => h !== host);
  if (hidden) list.push(host);
  await mascotHiddenHostsItem.setValue(list);
}

/** 所有已装修站点（用于设置页数据管理） */
export async function getAllDecorations(): Promise<Record<string, SiteDecoration[]>> {
  const all = await browser.storage.local.get(null);
  const out: Record<string, SiteDecoration[]> = {};
  for (const [k, v] of Object.entries(all)) {
    if (k.startsWith('deco:')) out[k.slice(5)] = v as SiteDecoration[];
  }
  return out;
}
export async function clearAllChats() {
  const all = await browser.storage.local.get(null);
  await browser.storage.local.remove(Object.keys(all).filter((k) => k.startsWith('chat:')));
}

