import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  imports: false,
  outDir: 'output',
  manifest: {
    name: 'PageStyler AI · AI 网页装修师',
    short_name: 'PageStyler AI',
    description: '用自然语言、预设主题和元素选择，像装修房间一样装修任意网页。',
    permissions: ['storage', 'activeTab', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'PageStyler AI' },
    commands: {
      'toggle-original': {
        suggested_key: { default: 'Alt+Shift+O' },
        description: '一键切换 装修效果 / 原样',
      },
      'open-panel': {
        suggested_key: { default: 'Alt+Shift+P' },
        description: '打开 / 关闭 装修面板',
      },
      'start-picker': {
        suggested_key: { default: 'Alt+Shift+E' },
        description: '进入元素选择模式',
      },
    },
  },
});
