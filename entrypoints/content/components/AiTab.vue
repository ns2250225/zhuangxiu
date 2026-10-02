<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { browser } from 'wxt/browser';
import { useStudio } from '../store';
import ScopeSwitch from './ScopeSwitch.vue';
import Mascot from '@/components/Mascot.vue';
import { formatTime, kebab } from '@/lib/utils';
import type { AIPlan } from '@/lib/types';

const s = useStudio();
const input = ref('');
const listEl = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const expanded = ref<Set<number>>(new Set());
const pending = ref<{ request: string; userPrompt: string; meta: ReturnType<typeof s.buildAIContext>['meta'] } | null>(null);
const showRaw = ref(false);

const SUGGESTIONS = [
  '把这个网页改成深色模式',
  '把整个网站变成 Neo Brutalism 风格',
  '让正文更适合阅读',
  '隐藏右边广告栏',
  '把导航栏改成粉黄撞色',
  '卡片圆角去掉，边框更粗',
  '把按钮改得更醒目一点',
];
const ELEMENT_SUGGESTIONS = ['改成粉黄撞色 Neo Brutalism 风格', '让它更醒目', '隐藏它们', '换成深色卡片风格', '加粗边框和硬阴影'];

const suggestions = computed(() => (s.selected.length ? ELEMENT_SUGGESTIONS : SUGGESTIONS));
const placeholder = computed(() =>
  s.draftPlan ? '继续修改：比如“按钮再大一点，颜色换成蓝色”' : s.selected.length ? `想把选中的 ${s.selected.length} 个元素改成什么样？` : '描述你想要的网页样子…',
);

watch(
  () => s.chat.length,
  async () => {
    await nextTick();
    listEl.value?.scrollTo({ top: listEl.value.scrollHeight, behavior: 'smooth' });
  },
  { immediate: true },
);

function send(text = input.value) {
  const request = text.trim();
  if (!request || s.aiBusy) return;
  if (s.settings.confirmBeforeSend) {
    const ctx = s.buildAIContext(request);
    pending.value = { request, userPrompt: ctx.userPrompt, meta: ctx.meta };
    return;
  }
  input.value = '';
  s.sendAI(request);
}
function confirmSend() {
  if (!pending.value) return;
  const p = pending.value;
  pending.value = null;
  input.value = '';
  s.sendAI(p.request, { userPrompt: p.userPrompt });
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey) && !e.isComposing) {
    e.preventDefault();
    send();
  }
}
function toggleExpand(i: number) {
  const n = new Set(expanded.value);
  n.has(i) ? n.delete(i) : n.add(i);
  expanded.value = n;
}
const isCurrent = (i: number) => i === s.draftMsgIndex && !!s.draftPlan;
const isPreviewing = (i: number) => isCurrent(i) && s.preview?.kind === 'ai';

function preview(plan: AIPlan, i: number) {
  s.draftMsgIndex = i;
  s.previewPlan(plan, s.draftScope);
}
function adopt(plan: AIPlan) {
  s.adoptPlan(isCurrentPlan(plan) ? s.draftPlan! : plan, s.draftScope);
}
const isCurrentPlan = (plan: AIPlan) => s.draftPlan === plan;
function continueEdit() {
  inputEl.value?.focus();
}
watch(
  () => s.draftScope,
  (scope) => {
    if (s.draftPlan && s.preview?.kind === 'ai') s.previewPlan(s.draftPlan, scope);
  },
);
const styleText = (st: Record<string, string>) =>
  Object.entries(st)
    .map(([k, v]) => `${kebab(k)}: ${v};`)
    .join(' ');
const openOptions = () => browser.runtime.sendMessage({ type: 'open-options' });
</script>

<template>
  <div class="ai">
    <div v-if="!s.aiReady" class="nb-card red ai-warn">
      <div class="nb-card-title">🔌 还没接入 AI 模型</div>
      <p>填写任意 OpenAI 兼容接口（URL / Key / Model）即可开启 AI 装修。没有 AI 也可以先用「预设」和「手动装修」。</p>
      <div class="nb-row" style="margin-top: 8px">
        <button class="nb-btn sm" @click="openOptions">去设置</button>
        <button class="nb-btn sm yellow" @click="s.panelTab = 'preset'">用预设</button>
      </div>
    </div>

    <div class="nb-card ai-target" :class="s.selected.length || s.customSelector ? 'blue' : 'green'">
      <div class="nb-row between">
        <b v-if="s.selected.length">🎯 只装修选中的 {{ s.useSimilar && s.similar ? s.similar.count : s.selected.length }} 个元素</b>
        <b v-else-if="s.customSelector">🎯 只装修 <code>{{ s.customSelector }}</code></b>
        <b v-else>🌐 装修整个页面</b>
        <button v-if="s.selected.length || s.customSelector" class="nb-btn sm" @click="s.clearSelection()">改为整页</button>
        <button v-else class="nb-btn sm" @click="s.startPicker()">选元素</button>
      </div>
      <ScopeSwitch v-model="s.draftScope" :path="s.path" style="margin-top: 8px" />
    </div>

    <div ref="listEl" class="ai-list">
      <div v-if="!s.chat.length" class="ai-hello">
        <Mascot :state="'idle'" :skin="s.settings.mascotSkin" :form="s.settings.mascotForm" :size="64" />
        <div class="ai-hello-bubble">嗨！告诉我你想把这个网页装修成什么样，我来出方案，你决定要不要～</div>
      </div>

      <template v-for="(m, i) in s.chat" :key="i">
        <div v-if="m.role === 'user'" class="ai-msg user">{{ m.content }}</div>
        <div v-else-if="m.error" class="ai-msg err">😵 {{ m.content }}</div>
        <div v-else-if="m.plan" class="ai-plan nb-card" :class="{ current: isCurrent(i) }">
          <div class="nb-row between">
            <div class="nb-card-title" style="margin: 0">
              <span class="nb-badge pink">AI</span>{{ m.plan.name }}
            </div>
            <span v-if="isPreviewing(i)" class="nb-badge yellow">PREVIEW</span>
          </div>
          <ul class="ai-explain">
            <li v-for="(e, j) in m.plan.explanation" :key="j">{{ e }}</li>
          </ul>
          <div class="ai-meta">
            {{ m.plan.rules.length }} 条规则<template v-if="m.plan.removeIds.length"> · 删除 {{ m.plan.removeIds.length }} 条</template>
            · {{ formatTime(m.at) }}
            <button class="ai-link" @click="toggleExpand(i)">{{ expanded.has(i) ? '收起规则' : '查看规则' }}</button>
          </div>
          <div v-if="m.plan.dropped.length" class="ai-dropped">🛡 已拦截 {{ m.plan.dropped.length }} 项不安全/无效内容</div>
          <div v-if="expanded.has(i)" class="ai-rules">
            <div v-for="r in m.plan.rules" :key="r.id" class="ai-rule">
              <code>{{ r.selector }}</code>
              <span v-if="r.note" class="ai-rule-note">{{ r.note }}</span>
              <div class="ai-rule-styles">{{ styleText(r.styles) }}</div>
            </div>
          </div>
          <div class="nb-row wrap ai-actions">
            <template v-if="isPreviewing(i)">
              <button class="nb-btn sm green" @click="adopt(m.plan)">✔ 采用</button>
              <button class="nb-btn sm" @click="s.cancelPreview()">取消</button>
              <button class="nb-btn sm blue" @click="continueEdit">继续修改</button>
            </template>
            <template v-else>
              <button class="nb-btn sm yellow" @click="preview(m.plan, i)">👀 预览</button>
              <button class="nb-btn sm green" @click="adopt(m.plan)">采用</button>
            </template>
          </div>
        </div>
      </template>

      <div v-if="s.aiBusy" class="ai-msg thinking">
        <span class="nb-spin"></span> 正在构思装修方案…
      </div>
    </div>

    <div v-if="pending" class="nb-card yellow ai-confirm nb-pop">
      <div class="nb-card-title">📤 即将发送给 AI</div>
      <ul>
        <li>页面结构摘要（{{ pending.meta.pageLines }} 行，标签/类名/尺寸）</li>
        <li v-if="pending.meta.includeText">少量可见文本片段</li>
        <li v-else>不包含页面文本</li>
        <li v-if="pending.meta.elements">选中元素 {{ pending.meta.elements }} 个</li>
        <li v-if="pending.meta.savedRules">已生效规则 {{ pending.meta.savedRules }} 条</li>
        <li>不包含：输入框内容、密码、Cookie、本地存储</li>
      </ul>
      <button class="ai-link" @click="showRaw = !showRaw">{{ showRaw ? '隐藏原文' : '查看发送原文' }}</button>
      <pre v-if="showRaw" class="nb-code ai-raw">{{ pending.userPrompt }}</pre>
      <div class="nb-row" style="margin-top: 8px">
        <button class="nb-btn sm green" @click="confirmSend">发送</button>
        <button class="nb-btn sm" @click="pending = null">取消</button>
      </div>
    </div>

    <div class="ai-input">
      <div class="ai-chips">
        <button v-for="t in suggestions" :key="t" class="nb-chip" @click="send(t)">{{ t }}</button>
      </div>
      <textarea
        ref="inputEl"
        v-model="input"
        class="nb-textarea"
        :placeholder="placeholder"
        rows="3"
        @keydown="onKey"
      ></textarea>
      <div class="nb-row between">
        <div class="nb-row">
          <button v-if="s.draftPlan" class="ai-link" @click="s.discardDraft()">放弃当前方案</button>
          <button v-if="s.chat.length" class="ai-link" @click="s.clearChat()">清空对话</button>
        </div>
        <button class="nb-btn pink" :disabled="s.aiBusy || !input.trim()" @click="send()">
          <span v-if="s.aiBusy" class="nb-spin"></span>
          {{ s.draftPlan ? '继续修改 ↵' : '生成方案 ↵' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-warn p {
  font-size: 12.5px;
  font-weight: 600;
}
.ai-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ai-hello {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.ai-hello-bubble {
  position: relative;
  padding: 10px 12px;
  font-weight: 700;
  font-size: 13px;
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 12px 12px 12px 2px;
  box-shadow: 3px 3px 0 var(--ink);
}
.ai-msg {
  padding: 8px 12px;
  font-weight: 700;
  font-size: 13px;
  border: 2.5px solid var(--ink);
  border-radius: 12px;
  max-width: 88%;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai-msg.user {
  align-self: flex-end;
  background: var(--ink);
  color: #fff;
  border-radius: 12px 12px 2px 12px;
}
.ai-msg.err {
  background: var(--red);
}
.ai-msg.thinking {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--blue);
}
.ai-plan.current {
  background: #fffbe0;
  box-shadow: 5px 5px 0 var(--pink), 5px 5px 0 2px var(--ink);
}
.ai-explain {
  margin: 8px 0 6px;
  padding-left: 18px;
  font-size: 13px;
  font-weight: 600;
}
.ai-explain li {
  margin: 2px 0;
}
.ai-meta {
  font-size: 11.5px;
  font-weight: 700;
  color: #444;
}
.ai-link {
  appearance: none;
  border: none;
  background: none;
  padding: 0 2px;
  font: 800 12px/1.4 var(--font);
  color: var(--ink);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-decoration-color: var(--pink);
  cursor: pointer;
}
.ai-dropped {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  background: var(--yellow);
  border: 2px solid var(--ink);
  border-radius: 6px;
}
.ai-rules {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 220px;
  overflow: auto;
}
.ai-rule {
  padding: 6px 8px;
  background: var(--cream);
  border: 2px solid var(--ink);
  border-radius: 6px;
  font-size: 11.5px;
}
.ai-rule code {
  font: 700 11.5px/1.3 var(--mono);
  word-break: break-all;
}
.ai-rule-note {
  margin-left: 6px;
  font-weight: 700;
  color: #b0287e;
}
.ai-rule-styles {
  margin-top: 3px;
  font-family: var(--mono);
  color: #333;
  word-break: break-all;
}
.ai-actions {
  margin-top: 10px;
}
.ai-confirm ul {
  margin: 0 0 6px;
  padding-left: 18px;
  font-size: 12.5px;
  font-weight: 600;
}
.ai-raw {
  max-height: 160px;
  overflow: auto;
  margin: 6px 0 0;
}
.ai-input {
  position: sticky;
  bottom: -12px;
  margin: 0 -12px -12px;
  padding: 10px 12px 12px;
  background: var(--cream);
  border-top: 3px solid var(--ink);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-chips {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.ai-chips .nb-chip {
  flex: none;
}
</style>
