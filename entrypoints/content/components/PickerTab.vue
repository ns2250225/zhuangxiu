<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from '../store';
import ManualEditor from './ManualEditor.vue';
import { describeElement, textSnippet } from '@/lib/selector-engine';
import { countMatches } from '@/lib/decoration-engine';
import { sanitizeSelector } from '@/lib/css-sanitize';
import { uid } from '@/lib/utils';

const s = useStudio();
const hasTarget = computed(() => !!s.selectionSelector);
const selectorValid = computed(() => !s.selectionSelector || !!sanitizeSelector(s.selectionSelector));
const matchCount = computed(() => (selectorValid.value && s.selectionSelector ? countMatches(s.selectionSelector) : 0));
const reselectRule = computed(() => (s.reselectFor ? s.savedRules.find((r) => r.id === s.reselectFor) : null));

function focusEl(el: Element) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function hide() {
  if (!selectorValid.value) return s.toast('选择器不合法', 'err');
  s.addRulesNow(
    [{ id: uid('man'), selector: s.selectionSelector, styles: { display: 'none' }, enabled: true, source: 'manual', priority: 0, note: '隐藏元素' }],
    'site',
    '已隐藏，可在「当前装修」里恢复或撤销',
  );
  s.clearSelection();
}
function askAI() {
  s.stopPicker();
  s.panelTab = 'ai';
}
function fixRule() {
  if (!reselectRule.value || !selectorValid.value) return;
  s.updateRule(reselectRule.value.id, { selector: s.selectionSelector });
  s.reselectFor = null;
  s.clearSelection();
  s.panelTab = 'rules';
}
</script>

<template>
  <div class="pk">
    <div v-if="reselectRule" class="nb-card red">
      <div class="nb-card-title">🩹 为失效规则重新选择元素</div>
      <code class="pk-sel">{{ reselectRule.note || reselectRule.selector }}</code>
      <div class="nb-row" style="margin-top: 8px">
        <button class="nb-btn sm green" :disabled="!hasTarget" @click="fixRule">用选中的元素修复</button>
        <button class="nb-btn sm" @click="s.reselectFor = null">算了</button>
      </div>
    </div>

    <div class="nb-card yellow">
      <div class="nb-row between">
        <div class="nb-card-title" style="margin: 0">🎯 元素选择</div>
        <button v-if="!s.picking" class="nb-btn sm pink" @click="s.startPicker()">开始选择</button>
        <button v-else class="nb-btn sm green" @click="s.stopPicker()">完成选择</button>
      </div>
      <ul class="pk-tips">
        <li>鼠标悬停高亮，<b>点击</b>选中</li>
        <li><b>Shift + 点击</b> 多选，<b>Alt + 点击</b> 取消</li>
        <li><b>↑ / ↓</b> 切换父 / 子元素，<b>Esc</b> 退出</li>
      </ul>
    </div>

    <div v-if="s.selected.length" class="nb-card">
      <div class="nb-row between">
        <div class="nb-card-title" style="margin: 0">已选 {{ s.selected.length }} 个元素</div>
        <div class="nb-row">
          <button class="nb-btn sm" title="选择父元素" @click="s.walkSelection('parent')">⬆ 父级</button>
          <button class="nb-btn sm" title="选择子元素" @click="s.walkSelection('child')">⬇ 子级</button>
          <button class="nb-btn sm red" @click="s.clearSelection()">清空</button>
        </div>
      </div>
      <div class="pk-list">
        <div v-for="(el, i) in s.selected" :key="i" class="pk-item" @click="focusEl(el)">
          <span class="pk-num">{{ i + 1 }}</span>
          <code>{{ describeElement(el) }}</code>
          <span class="pk-text">{{ textSnippet(el, 18) }}</span>
          <button class="pk-x" @click.stop="s.pick(el, 'remove')">×</button>
        </div>
      </div>

      <div v-if="s.similar" class="pk-similar" :class="{ on: s.useSimilar }">
        <span>🔍 检测到 <b>{{ s.similar.count }}</b> 个相似元素</span>
        <button class="nb-btn sm" :class="s.useSimilar ? 'black' : 'green'" @click="(s.useSimilar = !s.useSimilar), (s.customSelector = '')">
          {{ s.useSimilar ? '只装修这一个' : '应用到全部相似' }}
        </button>
      </div>
    </div>

    <div v-if="hasTarget || s.customSelector" class="nb-card">
      <span class="nb-label">目标选择器（可手动修改）</span>
      <input
        class="nb-input sm mono"
        :value="s.selectionSelector"
        @change="s.customSelector = ($event.target as HTMLInputElement).value"
      />
      <div class="pk-match" :class="{ bad: !selectorValid || !matchCount }">
        {{ !selectorValid ? '❌ 选择器不合法' : matchCount ? `✔ 命中 ${matchCount} 个元素` : '⚠ 没有命中元素' }}
      </div>
      <div class="nb-row wrap" style="margin-top: 10px">
        <button class="nb-btn sm pink" @click="askAI">🤖 让 AI 装修</button>
        <button class="nb-btn sm" @click="hide">🙈 隐藏元素</button>
      </div>
    </div>

    <ManualEditor v-if="hasTarget && selectorValid" :selector="s.selectionSelector" />

    <div v-if="!s.selected.length && !s.customSelector" class="nb-empty">
      还没有选中元素～点「开始选择」，在页面上点一点吧 👆
      <div style="margin-top: 10px">
        <span class="nb-label">或者直接输入 CSS 选择器</span>
        <input class="nb-input sm mono" placeholder="例如 .card, nav a" @change="s.customSelector = ($event.target as HTMLInputElement).value" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.pk {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pk-tips {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12.5px;
  font-weight: 600;
}
.pk-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
  max-height: 180px;
  overflow: auto;
}
.pk-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  background: var(--cream);
  border: 2px solid var(--ink);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}
.pk-item:hover {
  background: var(--yellow);
}
.pk-item code {
  font: 700 11.5px/1.3 var(--mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}
.pk-num {
  flex: none;
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  font-weight: 900;
  font-size: 11px;
  background: var(--blue);
  border: 2px solid var(--ink);
  border-radius: 50%;
}
.pk-text {
  flex: 1;
  min-width: 0;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pk-x {
  appearance: none;
  border: none;
  background: none;
  font: 900 16px/1 var(--font);
  cursor: pointer;
  color: var(--ink);
}
.pk-similar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 10px;
  padding: 8px;
  font-size: 12.5px;
  font-weight: 700;
  background: var(--green);
  border: 2.5px solid var(--ink);
  border-radius: 8px;
}
.pk-similar.on {
  background: var(--blue);
}
.pk-match {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 800;
  color: #137a2a;
}
.pk-match.bad {
  color: #c0301c;
}
.pk-sel {
  display: block;
  font: 700 11.5px/1.3 var(--mono);
  word-break: break-all;
}
</style>
