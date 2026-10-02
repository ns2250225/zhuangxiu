<script setup lang="ts">
import { computed } from 'vue';
import { browser } from 'wxt/browser';
import Mascot from '@/components/Mascot.vue';
import { useStudio } from '../store';
import type { PanelTab } from '@/lib/messages';
import AiTab from './AiTab.vue';
import PresetTab from './PresetTab.vue';
import PickerTab from './PickerTab.vue';
import RulesTab from './RulesTab.vue';
import CodeTab from './CodeTab.vue';

const s = useStudio();
const tabs: Array<{ id: PanelTab; label: string }> = [
  { id: 'ai', label: '🤖 AI装修' },
  { id: 'preset', label: '🧩 预设' },
  { id: 'picker', label: '🎯 选元素' },
  { id: 'rules', label: '📋 当前装修' },
  { id: 'code', label: '🔗 装修码' },
];
const side = computed(() => s.settings.panelSide);
const openOptions = () => browser.runtime.sendMessage({ type: 'open-options' });
</script>

<template>
  <aside class="ps-panel nb-pop" :class="[`side-${side}`, { collapsed: s.panelCollapsed }]">
    <header class="ps-head">
      <Mascot :state="s.mascotState" :skin="s.settings.mascotSkin" :form="s.settings.mascotForm" :size="40" />
      <div class="ps-title">
        <h1>PageStyler AI</h1>
        <span>AI 网页装修师</span>
      </div>
      <button class="nb-btn icon sm" title="设置" @click="openOptions">⚙</button>
      <button class="nb-btn icon sm" :title="s.panelCollapsed ? '展开' : '收起看效果'" @click="s.panelCollapsed = !s.panelCollapsed">
        {{ s.panelCollapsed ? '◀' : '▶' }}
      </button>
      <button class="nb-btn icon sm red" title="关闭" @click="(s.panelOpen = false), s.stopPicker()">×</button>
    </header>

    <template v-if="!s.panelCollapsed">
      <section class="ps-site">
        <div class="ps-site-host" :title="s.host + s.path">🌐 {{ s.host }}</div>
        <div class="nb-row wrap">
          <span v-if="s.preview" class="nb-badge yellow">PREVIEW</span>
          <span v-if="s.decorated && !s.paused" class="nb-badge green">● 已装修 · {{ s.savedRules.length }}</span>
          <span v-else-if="s.decorated && s.paused" class="nb-badge">OFF · 显示原样</span>
          <span v-else class="nb-badge">未装修</span>
          <span v-if="s.brokenRules.length" class="nb-badge red" title="部分规则找不到目标元素">⚠ {{ s.brokenRules.length }} 未命中</span>
          <span v-if="s.aiReady" class="nb-badge blue">AI</span>
        </div>
        <div class="nb-row ps-quick">
          <button class="nb-btn sm" :class="s.paused ? 'green' : 'cream'" @click="s.toggleOriginal()">
            {{ s.paused ? '✨ 恢复装修' : '👀 显示原样' }}
          </button>
          <button class="nb-btn sm" :disabled="!s.past.length" title="撤销" @click="s.undo()">↶ 撤销</button>
          <button class="nb-btn sm" :disabled="!s.future.length" title="重做" @click="s.redo()">↷ 重做</button>
        </div>
      </section>

      <nav class="nb-tabs ps-tabs">
        <button v-for="t in tabs" :key="t.id" class="nb-tab" :class="{ active: s.panelTab === t.id }" @click="s.panelTab = t.id">
          {{ t.label }}
        </button>
      </nav>

      <main class="ps-body">
        <AiTab v-if="s.panelTab === 'ai'" />
        <PresetTab v-else-if="s.panelTab === 'preset'" />
        <PickerTab v-else-if="s.panelTab === 'picker'" />
        <RulesTab v-else-if="s.panelTab === 'rules'" />
        <CodeTab v-else-if="s.panelTab === 'code'" />
      </main>

      <footer v-if="s.preview" class="ps-foot">
        <span class="nb-badge yellow">PREVIEW</span>
        <b class="ps-foot-label">{{ s.preview.label }}</b>
        <button class="nb-btn sm green" @click="s.adoptPreview()">✔ 采用</button>
        <button class="nb-btn sm" @click="s.cancelPreview()">取消</button>
        <button class="nb-btn sm blue" title="收起面板查看效果" @click="s.panelCollapsed = true">看效果</button>
      </footer>
    </template>
  </aside>
</template>

<style scoped>
.ps-panel {
  position: fixed;
  top: 12px;
  bottom: 12px;
  width: 400px;
  max-width: calc(100vw - 24px);
  display: flex;
  flex-direction: column;
  background: var(--cream);
  border: 3px solid var(--ink);
  border-radius: 14px;
  box-shadow: 8px 8px 0 var(--ink);
  z-index: 2147483645;
  overflow: hidden;
}
.ps-panel.side-right {
  right: 12px;
}
.ps-panel.side-left {
  left: 12px;
}
.ps-panel.collapsed {
  bottom: auto;
  width: 250px;
}
.ps-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: var(--yellow);
  border-bottom: 3px solid var(--ink);
}
.ps-title {
  flex: 1;
  min-width: 0;
  line-height: 1.1;
}
.ps-title h1 {
  font-size: 17px;
  font-weight: 900;
  letter-spacing: -0.3px;
}
.ps-title span {
  font-size: 11px;
  font-weight: 700;
}
.ps-site {
  padding: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  border-bottom: 3px solid var(--ink);
  background: #fff;
}
.ps-site-host {
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ps-quick {
  margin-top: 2px;
}
.ps-tabs {
  padding: 10px 12px;
  border-bottom: 3px solid var(--ink);
  background: var(--pink);
}
.ps-tabs {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
}
.ps-tabs .nb-tab {
  padding: 7px 2px;
  font-size: 11.5px;
  text-align: center;
  white-space: nowrap;
}
.ps-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  overscroll-behavior: contain;
}
.ps-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-top: 3px solid var(--ink);
  background: #fff;
}
.ps-foot-label {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
