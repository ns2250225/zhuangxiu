import { browser } from 'wxt/browser';
import type { TabMessage } from './messages';

/** 确保标签页里有 content script（插件安装前就打开的页面需要补注入） */
export async function sendToTab<T = unknown>(tabId: number, msg: TabMessage): Promise<T> {
  try {
    return (await browser.tabs.sendMessage(tabId, msg)) as T;
  } catch {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/content.js'] });
    await new Promise((r) => setTimeout(r, 400));
    return (await browser.tabs.sendMessage(tabId, msg)) as T;
  }
}
