<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import Mascot from '@/components/Mascot.vue';
import {
  DEFAULT_AI,
  DEFAULT_SETTINGS,
  aiConfigItem,
  clearAllChats,
  getAIConfig,
  getAllDecorations,
  getSettings,
  mascotHiddenHostsItem,
  pausedHostsItem,
  setDecorations,
  settingsItem,
} from '@/lib/storage';
import { BackupSchema } from '@/lib/schema';
import { sanitizeSelector, sanitizeStyles } from '@/lib/css-sanitize';
import { formatTime } from '@/lib/utils';
import type { AIConfig, MascotForm, MascotSkin, MascotState, SiteDecoration, Settings } from '@/lib/types';
import type { BgResponse } from '@/lib/messages';

const section = ref('ai');
const NAV = [
  { id: 'ai', label: '🤖 AI 模型' },
  { id: 'mascot', label: '🐣 吉祥物' },
  { id: 'general', label: '🎛 面板与隐私' },
  { id: 'data', label: '🗂 数据管理' },
  { id: 'keys', label: '⌨ 快捷键' },
];

/* ---------------- AI ---------------- */
const ai = reactive<AIConfig>({ ...DEFAULT_AI });
const showKey = ref(false);
const testing = ref(false);
const testResult = ref<{ ok: boolean; text: string } | null>(null);
const savedTip = ref('');
const PROVIDERS = [
  { name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { name: 'Ollama', url: 'http://localhost:11434/v1', model: 'qwen2.5:7b' },
  { name: 'vLLM', url: 'http://localhost:8000/v1', model: '' },
];

async function saveAI() {
  await aiConfigItem.setValue({
    ...ai,
    apiUrl: ai.apiUrl.trim(),
    apiKey: ai.apiKey.trim(),
    model: ai.model.trim(),
    temperature: Number(ai.temperature),
    maxTokens: Number(ai.maxTokens) || DEFAULT_AI.maxTokens,
    timeout: Number(ai.timeout) || DEFAULT_AI.timeout,
  });
  tip('AI 配置已保存 ✔');
}
async function testAI() {
  testing.value = true;
  testResult.value = null;
  const res = (await browser.runtime.sendMessage({ type: 'ai:test', config: { ...ai } })) as BgResponse;
  testing.value = false;
  testResult.value = res.ok
    ? { ok: true, text: `连接成功！模型回复：${res.content.slice(0, 60)}` }
    : { ok: false, text: res.error };
}
const timeoutSec = computed({
  get: () => Math.round(ai.timeout / 1000),
  set: (v: number) => (ai.timeout = Number(v) * 1000),
});

/* ---------------- 设置 ---------------- */
const st = reactive<Settings>({ ...DEFAULT_SETTINGS });
const hiddenHosts = ref<string[]>([]);
const pausedHosts = ref<string[]>([]);
let loaded = false;
watch(
  st,
  async (v) => {
    if (loaded) await settingsItem.setValue({ ...v });
  },
  { deep: true },
);
const SKINS: Array<[MascotSkin, string]> = [
  ['yellow', '柠檬黄'],
  ['pink', '泡泡粉'],
  ['blue', '汽水蓝'],
  ['green', '薄荷绿'],
];
const FORMS: Array<[MascotForm, string]> = [
  ['robot', '天线机器人'],
  ['cat', '猫猫机器人'],
  ['painter', '小画家'],
];
const STATES: Array<[MascotState, string]> = [
  ['idle', '待机'],
  ['thinking', '正在思考'],
  ['decorating', '装修中'],
  ['success', '装修成功'],
  ['paused', '装修暂停'],
  ['warning', '规则失效'],
];

/* ---------------- 数据 ---------------- */
const all = ref<Record<string, SiteDecoration[]>>({});
const hostList = computed(() =>
  Object.entries(all.value)
    .map(([host, list]) => ({
      host,
      decos: list.length,
      rules: list.reduce((n, d) => n + d.rules.length, 0),
      updated: Math.max(...list.map((d) => d.updatedAt)),
    }))
    .sort((a, b) => b.updated - a.updated),
);
const confirmClear = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);

async function loadData() {
  all.value = await getAllDecorations();
  hiddenHosts.value = await mascotHiddenHostsItem.getValue();
  pausedHosts.value = await pausedHostsItem.getValue();
}
async function removeHost(host: string) {
  await setDecorations(host, []);
  await loadData();
  tip(`已删除 ${host} 的装修`);
}
async function clearAll() {
  for (const host of Object.keys(all.value)) await setDecorations(host, []);
  confirmClear.value = false;
  await loadData();
  tip('所有装修数据已清空');
}
function exportAll() {
  const data = { app: 'pagestyler-ai', version: 1, exportedAt: Date.now(), decorations: all.value };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pagestyler-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    const parsed = BackupSchema.parse(JSON.parse(await f.text()));
    let n = 0;
    for (const [host, list] of Object.entries(parsed.decorations)) {
      if (!/^[a-z0-9.-]+$/i.test(host)) continue;
      const clean: SiteDecoration[] = (list as SiteDecoration[])
        .filter((d) => d && Array.isArray(d.rules))
        .map((d) => ({
          ...d,
          host,
          rules: d.rules
            .map((r) => ({ ...r, selector: sanitizeSelector(r.selector) ?? '', styles: sanitizeStyles(r.styles).styles }))
            .filter((r) => r.selector && Object.keys(r.styles).length),
        }));
      const existing = all.value[host] ?? [];
      const ids = new Set(existing.map((d) => d.id));
      await setDecorations(host, [...existing, ...clean.filter((d) => !ids.has(d.id))]);
      n++;
    }
    await loadData();
    tip(`已导入 ${n} 个站点的装修`);
  } catch {
    tip('导入失败：文件格式不正确', true);
  }
  if (fileEl.value) fileEl.value.value = '';
}
async function unhide(host: string) {
  await mascotHiddenHostsItem.setValue(hiddenHosts.value.filter((h) => h !== host));
  await loadData();
}
async function unpause(host: string) {
  await pausedHostsItem.setValue(pausedHosts.value.filter((h) => h !== host));
  await loadData();
}
async function clearChats() {
  await clearAllChats();
  tip('AI 对话记录已清空');
}

/* ---------------- 快捷键 ---------------- */
const commands = ref<Array<{ name?: string; description?: string; shortcut?: string }>>([]);
const openShortcuts = () => browser.tabs.create({ url: 'chrome://extensions/shortcuts' });

/* ---------------- 通用 ---------------- */
const toast = ref<{ text: string; err: boolean } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function tip(text: string, err = false) {
  toast.value = { text, err };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 2400);
  savedTip.value = text;
}

onMounted(async () => {
  Object.assign(ai, await getAIConfig());
  Object.assign(st, await getSettings());
  await loadData();
  commands.value = (await browser.commands?.getAll?.()) ?? [];
  setTimeout(() => (loaded = true));
  const hash = location.hash.slice(1);
  if (NAV.some((n) => n.id === hash)) section.value = hash;
});
</script>

<template>
  <div class="nb opt">
    <aside class="opt-side">
      <div class="opt-brand">
        <Mascot :state="'idle'" :skin="st.mascotSkin" :form="st.mascotForm" :size="72" />
        <h1>PageStyler AI</h1>
        <span class="nb-badge black">设置中心</span>
      </div>
      <nav class="opt-nav">
        <button v-for="n in NAV" :key="n.id" class="nb-tab" :class="{ active: section === n.id }" @click="section = n.id">
          {{ n.label }}
        </button>
      </nav>
    </aside>

    <main class="opt-main">
      <!-- AI 模型 -->
      <section v-if="section === 'ai'" class="nb-card opt-card">
        <h2>🤖 AI 模型接入</h2>
        <p class="nb-hint">支持任意 OpenAI 兼容的 Chat Completions 接口（OpenAI / OpenRouter / vLLM / Ollama / 自建网关…）。Key 只保存在本地浏览器。</p>
        <div class="nb-row wrap opt-providers">
          <button
            v-for="p in PROVIDERS"
            :key="p.name"
            class="nb-chip"
            @click="(ai.apiUrl = p.url), p.model && (ai.model = p.model)"
          >
            {{ p.name }}
          </button>
        </div>
        <div class="nb-field">
          <label class="nb-label">API URL</label>
          <input v-model="ai.apiUrl" class="nb-input mono" placeholder="https://api.openai.com/v1" />
          <span class="nb-hint">会自动补全 /chat/completions</span>
        </div>
        <div class="nb-field">
          <label class="nb-label">API Key</label>
          <div class="nb-row">
            <input v-model="ai.apiKey" :type="showKey ? 'text' : 'password'" class="nb-input mono" placeholder="sk-...（本地模型可留空）" autocomplete="off" />
            <button class="nb-btn sm" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button>
          </div>
        </div>
        <div class="nb-field">
          <label class="nb-label">Model</label>
          <input v-model="ai.model" class="nb-input mono" placeholder="gpt-4o-mini" />
        </div>
        <div class="nb-grid-3">
          <div class="nb-field">
            <label class="nb-label">Temperature：{{ ai.temperature }}</label>
            <input v-model.number="ai.temperature" type="range" min="0" max="1.5" step="0.1" class="nb-range" />
          </div>
          <div class="nb-field">
            <label class="nb-label">Max Tokens</label>
            <input v-model.number="ai.maxTokens" type="number" min="256" max="64000" step="256" class="nb-input" />
          </div>
          <div class="nb-field">
            <label class="nb-label">超时（秒）</label>
            <input v-model.number="timeoutSec" type="number" min="5" max="600" class="nb-input" />
          </div>
        </div>
        <div class="nb-row">
          <button class="nb-btn green" @click="saveAI">保存配置</button>
          <button class="nb-btn blue" :disabled="testing || !ai.apiUrl" @click="testAI">
            <span v-if="testing" class="nb-spin"></span> 测试连接
          </button>
        </div>
        <div v-if="testResult" class="opt-result" :class="testResult.ok ? 'ok' : 'err'">
          {{ testResult.ok ? '✔' : '✘' }} {{ testResult.text }}
        </div>
        <div class="nb-card cream opt-safe">
          <b>🛡 安全承诺</b>
          <ul>
            <li>AI 只能返回结构化的样式规则，插件不会执行任何 AI 生成的脚本</li>
            <li>只发送页面结构摘要（标签 / 类名 / 尺寸 / 少量可见文本），不读取输入框、密码、Cookie、本地存储</li>
            <li>装修码永远不包含 API URL / Key</li>
          </ul>
        </div>
      </section>

      <!-- 吉祥物 -->
      <section v-else-if="section === 'mascot'" class="nb-card opt-card">
        <h2>🐣 吉祥物</h2>
        <label class="opt-switch-row">
          <span><b>在网页上显示吉祥物入口</b><br /><span class="nb-hint">单击打开面板 · 长按/右键快捷菜单 · 拖动贴边</span></span>
          <span class="nb-switch"><input v-model="st.mascotEnabled" type="checkbox" /><span></span></span>
        </label>
        <div class="nb-field">
          <span class="nb-label">配色</span>
          <div class="opt-pick">
            <button v-for="[k, l] in SKINS" :key="k" class="opt-pick-item" :class="{ on: st.mascotSkin === k }" @click="st.mascotSkin = k">
              <Mascot :skin="k" :form="st.mascotForm" :size="56" still />
              <span>{{ l }}</span>
            </button>
          </div>
        </div>
        <div class="nb-field">
          <span class="nb-label">形态</span>
          <div class="opt-pick">
            <button v-for="[k, l] in FORMS" :key="k" class="opt-pick-item" :class="{ on: st.mascotForm === k }" @click="st.mascotForm = k">
              <Mascot :skin="st.mascotSkin" :form="k" :size="56" still />
              <span>{{ l }}</span>
            </button>
          </div>
        </div>
        <div class="nb-field">
          <span class="nb-label">大小：{{ st.mascotSize }}px</span>
          <input v-model.number="st.mascotSize" type="range" min="48" max="110" step="2" class="nb-range" style="max-width: 320px" />
        </div>
        <div class="nb-field">
          <span class="nb-label">状态表情一览</span>
          <div class="opt-states">
            <div v-for="[k, l] in STATES" :key="k" class="opt-state">
              <Mascot :state="k" :skin="st.mascotSkin" :form="st.mascotForm" :size="76" />
              <span>{{ l }}</span>
            </div>
          </div>
        </div>
        <div v-if="hiddenHosts.length" class="nb-field">
          <span class="nb-label">已隐藏吉祥物的网站</span>
          <div class="nb-row wrap">
            <span v-for="h in hiddenHosts" :key="h" class="nb-chip" @click="unhide(h)">{{ h }} ✕</span>
          </div>
        </div>
      </section>

      <!-- 面板与隐私 -->
      <section v-else-if="section === 'general'" class="nb-card opt-card">
        <h2>🎛 面板与隐私</h2>
        <div class="nb-field">
          <span class="nb-label">装修面板位置</span>
          <div class="nb-row">
            <button class="nb-btn sm" :class="{ black: st.panelSide === 'left' }" @click="st.panelSide = 'left'">◧ 左侧</button>
            <button class="nb-btn sm" :class="{ black: st.panelSide === 'right' }" @click="st.panelSide = 'right'">◨ 右侧</button>
          </div>
        </div>
        <label class="opt-switch-row">
          <span><b>发送给 AI 前先确认</b><br /><span class="nb-hint">展示将要发送的内容类型和原文</span></span>
          <span class="nb-switch"><input v-model="st.confirmBeforeSend" type="checkbox" /><span></span></span>
        </label>
        <label class="opt-switch-row">
          <span><b>页面摘要包含少量可见文本</b><br /><span class="nb-hint">帮助 AI 识别区域；关闭后只发送标签/类名/尺寸</span></span>
          <span class="nb-switch"><input v-model="st.includeText" type="checkbox" /><span></span></span>
        </label>
        <label class="opt-switch-row">
          <span><b>本地保存 AI 对话记录</b><br /><span class="nb-hint">按网站保存在本机，不会上传</span></span>
          <span class="nb-switch"><input v-model="st.saveChat" type="checkbox" /><span></span></span>
        </label>
        <button class="nb-btn sm red" @click="clearChats">清空所有对话记录</button>
      </section>

      <!-- 数据管理 -->
      <section v-else-if="section === 'data'" class="nb-card opt-card">
        <h2>🗂 数据管理</h2>
        <div class="nb-row wrap">
          <button class="nb-btn yellow" :disabled="!hostList.length" @click="exportAll">⬇ 导出全部装修</button>
          <button class="nb-btn blue" @click="fileEl?.click()">⬆ 导入备份</button>
          <input ref="fileEl" type="file" accept="application/json,.json" hidden @change="importFile" />
          <button v-if="!confirmClear" class="nb-btn red" :disabled="!hostList.length" @click="confirmClear = true">清空全部</button>
          <template v-else>
            <button class="nb-btn black" @click="clearAll">确定清空？</button>
            <button class="nb-btn" @click="confirmClear = false">取消</button>
          </template>
        </div>
        <div class="opt-table">
          <div v-if="!hostList.length" class="nb-empty">还没有装修过任何网站</div>
          <div v-for="h in hostList" :key="h.host" class="opt-tr">
            <b class="opt-host">{{ h.host }}</b>
            <span class="nb-badge">{{ h.decos }} 套</span>
            <span class="nb-badge blue">{{ h.rules }} 条规则</span>
            <span v-if="pausedHosts.includes(h.host)" class="nb-badge" title="点击恢复" style="cursor: pointer" @click="unpause(h.host)">OFF ↺</span>
            <span class="opt-time">{{ formatTime(h.updated) }}</span>
            <button class="nb-btn sm red" @click="removeHost(h.host)">删除</button>
          </div>
        </div>
      </section>

      <!-- 快捷键 -->
      <section v-else class="nb-card opt-card">
        <h2>⌨ 快捷键</h2>
        <div class="opt-table">
          <div v-for="c in commands.filter((x) => x.description)" :key="c.name" class="opt-tr">
            <b style="flex: 1">{{ c.description }}</b>
            <span class="nb-badge yellow">{{ c.shortcut || '未设置' }}</span>
          </div>
        </div>
        <button class="nb-btn sm" style="margin-top: 12px" @click="openShortcuts">去浏览器修改快捷键</button>
      </section>
    </main>

    <div v-if="toast" class="opt-toast nb-pop" :class="{ err: toast.err }">{{ toast.text }}</div>
  </div>
</template>

<style>
html,
body {
  margin: 0;
  min-height: 100%;
  background: #fff8e1;
  background-image: radial-gradient(#11111118 1.4px, transparent 1.4px);
  background-size: 18px 18px;
}
.opt {
  display: flex;
  gap: 24px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 28px 24px 60px;
}
.opt-side {
  position: sticky;
  top: 28px;
  align-self: flex-start;
  width: 220px;
  flex: none;
}
.opt-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px;
  background: #ffd84d;
  border: 3px solid #111;
  border-radius: 14px;
  box-shadow: 6px 6px 0 #111;
}
.opt-brand h1 {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.6px;
}
.opt-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
}
.opt-nav .nb-tab {
  text-align: left;
  padding: 11px 12px;
  font-size: 14px;
}
.opt-main {
  flex: 1;
  min-width: 0;
}
.opt-card {
  padding: 22px;
  box-shadow: 8px 8px 0 #111;
}
.opt-card h2 {
  font-size: 22px;
  font-weight: 900;
  margin-bottom: 6px;
}
.opt-card > .nb-hint {
  display: block;
  margin-bottom: 14px;
}
.opt-providers {
  margin-bottom: 14px;
}
.nb-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.opt-result {
  margin-top: 12px;
  padding: 8px 12px;
  font-weight: 800;
  border: 3px solid #111;
  border-radius: 8px;
  word-break: break-word;
}
.opt-result.ok {
  background: #7dff8a;
}
.opt-result.err {
  background: #ff6b57;
}
.opt-safe {
  margin-top: 18px;
}
.opt-safe ul {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 13px;
  font-weight: 600;
}
.opt-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 2.5px dashed #111;
  margin-bottom: 12px;
  cursor: pointer;
}
.opt-pick {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.opt-pick-item {
  appearance: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px 8px;
  font: 800 12px/1.2 var(--font);
  color: #111;
  background: #fff;
  border: 3px solid #111;
  border-radius: 10px;
  box-shadow: 3px 3px 0 #111;
  cursor: pointer;
}
.opt-pick-item.on {
  background: #ffd84d;
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #111;
}
.opt-states {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.opt-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px;
  font-weight: 800;
  font-size: 12px;
  background: #fff8e1;
  border: 2.5px solid #111;
  border-radius: 10px;
}
.opt-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}
.opt-tr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff8e1;
  border: 2.5px solid #111;
  border-radius: 8px;
}
.opt-host {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.opt-time {
  font-size: 12px;
  font-weight: 600;
  color: #444;
}
.opt-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 16px;
  font-weight: 800;
  background: #7dff8a;
  border: 3px solid #111;
  border-radius: 10px;
  box-shadow: 4px 4px 0 #111;
}
.opt-toast.err {
  background: #ff6b57;
}
.opt-toast.nb-pop {
  animation: none;
}
@media (max-width: 760px) {
  .opt {
    flex-direction: column;
  }
  .opt-side {
    position: static;
    width: auto;
  }
  .opt-states {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
