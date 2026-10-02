import { defineContentScript } from 'wxt/utils/define-content-script';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { browser } from 'wxt/browser';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import '@/assets/nb.css';
import './ui.css';
import App from './App.vue';
import { useStudio } from './store';
import { UI_TAG } from '@/lib/decoration-engine';
import type { TabMessage } from '@/lib/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_start',
  cssInjectionMode: 'ui',
  async main(ctx) {
    // 防止补注入时重复运行
    const w = window as unknown as { __pagestylerLoaded?: boolean };
    if (w.__pagestylerLoaded) return;
    w.__pagestylerLoaded = true;

    const pinia = createPinia();
    const studio = useStudio(pinia);
    // 尽早注入已保存的装修，减少“闪原样”
    await studio.init();

    browser.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
      const msg = raw as TabMessage;
      switch (msg?.type) {
        case 'status:get':
          sendResponse(studio.status());
          return;
        case 'panel:open':
          studio.panelOpen = true;
          studio.panelCollapsed = false;
          if (msg.tab) studio.panelTab = msg.tab;
          break;
        case 'panel:toggle':
          studio.panelOpen = !studio.panelOpen;
          break;
        case 'toggle-original':
          studio.toggleOriginal();
          break;
        case 'picker:start':
          studio.startPicker();
          break;
        case 'mascot:show':
          studio.mascotHidden = false;
          break;
        default:
          return;
      }
      sendResponse(studio.status());
    });

    // navigate 事件在 URL 提交前触发，所以用事件里的 newUrl，并在提交后再校准一次
    ctx.addEventListener(window, 'wxt:locationchange', (e) => {
      studio.onLocationChange(e.newUrl?.pathname);
      setTimeout(() => studio.onLocationChange(), 60);
    });

    if (document.readyState === 'loading') {
      await new Promise<void>((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true }));
    }

    const ui = await createShadowRootUi(ctx, {
      name: UI_TAG,
      position: 'inline',
      anchor: 'html',
      append: 'last',
      isolateEvents: ['keydown', 'keyup', 'keypress', 'wheel'],
      onMount(container) {
        const app = createApp(App);
        app.use(pinia);
        app.mount(container);
        return app;
      },
      onRemove(app) {
        app?.unmount();
      },
    });
    ui.mount();
    studio.recountHits();

    // DOM 变化（SPA 渲染 / 懒加载）后重新统计命中，节流处理
    const mo = new MutationObserver(() => studio.recountLater());
    mo.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => mo.disconnect());
  },
});
