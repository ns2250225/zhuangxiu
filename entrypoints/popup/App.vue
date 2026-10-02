<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { browser } from 'wxt/browser';
import Mascot from '@/components/Mascot.vue';
import { sendToTab } from '@/lib/tabs';
import { hostOf, isRestrictedUrl } from '@/lib/utils';
import { getAIConfig, getSettings, mascotHiddenHostsItem, setMascotHidden, togglePaused } from '@/lib/storage';
import type { MascotState, PageStatus, Settings } from '@/lib/types';
import type { PanelTab, TabMessage } from '@/lib/messages';

const tabId = ref<number>();
const host = ref('');
const restricted = ref(false);
const status = ref<PageStatus | null>(null);
const failed = ref(false);
const settings = ref<Settings | null>(null);
const aiReady = ref(false);
const mascotHidden = ref(false);
const busy = ref(false);

onMounted(async () => {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  tabId.value = tab?.id;
  host.value = hostOf(tab?.url);
  restricted.value = isRestrictedUrl(tab?.url);
  settings.value = await getSettings();
  const cfg = await getAIConfig();
  aiReady.value = !!(cfg.apiUrl && cfg.model);
  mascotHidden.value = (await mascotHiddenHostsItem.getValue()).includes(host.value);
  if (!restricted.value) await refresh();
});

async function send(msg: TabMessage) {
  if (!tabId.value) return null;
  try {
    const res = await sendToTab<PageStatus>(tabId.value, msg);
    failed.value = false;
    return res;
  } catch {
    failed.value = true;
    return null;
  }
}
async function refresh() {
  status.value = await send({ type: 'status:get' });
}
async function openPanel(tab?: PanelTab) {
  await send({ type: 'panel:open', tab });
  window.close();
}
async function picker() {
  await send({ type: 'picker:start' });
  window.close();
}
async function toggleOriginal() {
  busy.value = true;
  await togglePaused(host.value);
  await refresh();
  busy.value = false;
}
async function showMascot() {
  await setMascotHidden(host.value, false);
  mascotHidden.value = false;
}
const openOptions = () => browser.runtime.openOptionsPage();

const mascotState = computed<MascotState>(() => {
  if (restricted.value || failed.value) return 'warning';
  if (!status.value) return 'thinking';
  if (status.value.paused && status.value.decorated) return 'paused';
  if (status.value.missCount) return 'warning';
  return status.value.decorated ? 'success' : 'idle';
});
const statusLabel = computed(() => {
  const st = status.value;
  if (!st) return { text: '连接中…', cls: '' };
  if (!st.decorated) return { text: '未装修', cls: '' };
  if (st.paused) return { text: '已暂停 · 显示原样', cls: '' };
  return { text: `已装修 · ${st.ruleCount} 条规则`, cls: 'green' };
});
</script>

<template>
  <div class="nb pop">
    <header class="pop-head">
      <Mascot
        :state="mascotState"
        :skin="settings?.mascotSkin ?? 'yellow'"
        :form="settings?.mascotForm ?? 'robot'"
        :size="56"
      />
      <div>
        <h1>PageStyler AI</h1>
        <div class="pop-sub">
          <span class="nb-badge black">Neo Brutal UI</span>
          <span v-if="aiReady" class="nb-badge blue">AI 已接入</span>
          <span v-else class="nb-badge red">AI 未配置</span>
        </div>
      </div>
    </header>

    <section class="nb-card pop-site">
      <div class="pop-row"><span>当前网站</span><b class="pop-host">{{ host || '—' }}</b></div>
      <div v-if="!restricted" class="pop-row">
        <span>状态</span>
        <span class="nb-badge" :class="statusLabel.cls">{{ statusLabel.text }}</span>
      </div>
      <div v-if="status?.missCount" class="pop-row">
        <span>提醒</span><span class="nb-badge red">⚠ {{ status.missCount }} 条规则未命中</span>
      </div>
      <div v-if="status?.decorationNames.length" class="pop-names">{{ status.decorationNames.join(' · ') }}</div>
    </section>

    <div v-if="restricted" class="nb-card red pop-warn">
      <b>🚧 这个页面受浏览器安全限制</b>
      <p>chrome:// 、edge://、扩展页、应用商店等内部页面不允许装修。换个普通网页试试吧！</p>
    </div>
    <div v-else-if="failed" class="nb-card yellow pop-warn">
      <b>😵 没连上页面</b>
      <p>刷新一下网页再试试。</p>
    </div>

    <div v-else class="pop-actions">
      <button class="nb-btn yellow lg block" @click="openPanel()">🎨 打开装修师</button>
      <button
        class="nb-btn block"
        :class="status?.paused ? 'green' : 'pink'"
        :disabled="busy || !status?.decorated"
        @click="toggleOriginal"
      >
        {{ status?.paused ? '✨ 恢复装修' : '👀 显示原样' }}
      </button>
      <div class="nb-grid-2">
        <button class="nb-btn blue" @click="picker">🎯 选择元素</button>
        <button class="nb-btn green" @click="openPanel('preset')">🧩 预设主题</button>
        <button class="nb-btn" @click="openPanel('code')">📥 导入装修码</button>
        <button class="nb-btn" @click="openPanel('rules')">📋 当前装修</button>
      </div>
      <button v-if="mascotHidden" class="nb-btn sm cream block" @click="showMascot">🤖 在本站重新显示吉祥物</button>
    </div>

    <footer class="pop-foot">
      <button class="nb-btn sm black" @click="openOptions">⚙ 设置</button>
      <span class="pop-keys">Alt+Shift+O 原样 · Alt+Shift+P 面板</span>
    </footer>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  background: #ffd84d;
}
.pop {
  width: 320px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #ffd84d;
  background-image: radial-gradient(#11111122 1.2px, transparent 1.2px);
  background-size: 14px 14px;
}
.pop-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pop-head h1 {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.6px;
  line-height: 1.1;
}
.pop-sub {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}
.pop-site {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
}
.pop-host {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pop-names {
  font-size: 11.5px;
  font-weight: 600;
  color: #444;
}
.pop-warn p {
  margin-top: 4px;
  font-size: 12.5px;
  font-weight: 600;
}
.pop-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pop-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.pop-keys {
  font-size: 10.5px;
  font-weight: 700;
}
</style>
