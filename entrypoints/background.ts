import { defineBackground } from 'wxt/utils/define-background';
import { browser } from 'wxt/browser';
import { chatCompletion } from '@/lib/ai/client';
import { getAIConfig } from '@/lib/storage';
import type { BgMessage, BgResponse, TabMessage } from '@/lib/messages';
import { isRestrictedUrl } from '@/lib/utils';
import { sendToTab } from '@/lib/tabs';


export default defineBackground(() => {
  browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as BgMessage;
    const run = async (): Promise<BgResponse> => {
      try {
        if (msg.type === 'ai:chat') {
          const cfg = await getAIConfig();
          return { ok: true, content: await chatCompletion(cfg, msg.messages) };
        }
        if (msg.type === 'ai:test') {
          const cfg = msg.config ?? (await getAIConfig());
          const content = await chatCompletion(
            { ...cfg, timeout: Math.min(cfg.timeout, 30000) },
            [{ role: 'user', content: '请只回复 OK' }],
            { maxTokens: 16 },
          );
          return { ok: true, content };
        }
        if (msg.type === 'open-options') {
          await browser.runtime.openOptionsPage();
          return { ok: true, content: '' };
        }
        return { ok: false, error: '未知消息' };
      } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
      }
    };
    if (['ai:chat', 'ai:test', 'open-options'].includes(msg?.type)) {
      run().then(sendResponse);
      return true;
    }
  });

  browser.commands?.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || isRestrictedUrl(tab.url)) return;
    const map: Record<string, TabMessage> = {
      'toggle-original': { type: 'toggle-original' },
      'open-panel': { type: 'panel:toggle' },
      'start-picker': { type: 'picker:start' },
    };
    if (map[command]) sendToTab(tab.id, map[command]).catch(() => {});
  });
});
