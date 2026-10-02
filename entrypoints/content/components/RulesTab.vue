<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useStudio } from '../store';
import RuleEditor from './RuleEditor.vue';
import { kebab } from '@/lib/utils';
import type { DecorationRule, RuleSource } from '@/lib/types';

const s = useStudio();
const editing = ref<string | null>(null);
const renaming = ref<string | null>(null);
const renameText = ref('');
const confirmKind = ref<'page' | 'site' | null>(null);

onMounted(() => s.recountHits());

const SOURCE: Record<RuleSource, { label: string; cls: string }> = {
  ai: { label: 'AI', cls: 'pink' },
  preset: { label: '预设', cls: 'yellow' },
  manual: { label: '手动', cls: 'blue' },
  import: { label: '导入', cls: 'green' },
};

/** 同一选择器、同一属性被多条启用规则设置 → 冲突 */
const conflicts = computed(() => {
  const map = new Map<string, string[]>();
  for (const r of s.savedRules) {
    if (!r.enabled) continue;
    const sel = r.selector.replace(/\s+/g, ' ').trim();
    for (const p of Object.keys(r.styles)) {
      const k = `${sel}|${p}`;
      map.set(k, [...(map.get(k) ?? []), r.id]);
    }
  }
  const out = new Map<string, string[]>();
  for (const [k, ids] of map) {
    if (ids.length < 2) continue;
    const prop = kebab(k.split('|')[1] ?? '');
    for (const id of ids) out.set(id, [...(out.get(id) ?? []), prop]);
  }
  return out;
});

const scopeLabel = (p: string) => (p === '/*' ? '整站' : p);
const summary = (r: DecorationRule) =>
  Object.entries(r.styles)
    .slice(0, 3)
    .map(([k, v]) => `${kebab(k)}: ${v}`)
    .join('; ') + (Object.keys(r.styles).length > 3 ? ' …' : '');

function startRename(id: string, name: string) {
  renaming.value = id;
  renameText.value = name;
}
function doRename(id: string) {
  if (renameText.value.trim()) s.renameDeco(id, renameText.value.trim());
  renaming.value = null;
}
function aiRepair() {
  s.panelTab = 'ai';
  s.clearSelection();
  s.sendAI('网页可能改版了，请修复这些失效的装修规则', { repair: true });
}
function reselect(r: DecorationRule) {
  s.reselectFor = r.id;
  s.startPicker();
}
async function doDelete() {
  if (confirmKind.value === 'page') await s.deletePageDecos();
  else if (confirmKind.value === 'site') await s.deleteSiteDecos();
  confirmKind.value = null;
}
const hitOf = (id: string) => s.hits[id];
</script>

<template>
  <div class="rl">
    <div class="nb-row wrap">
      <button class="nb-btn sm" :disabled="!s.past.length" @click="s.undo()">↶ 撤销</button>
      <button class="nb-btn sm" :disabled="!s.future.length" @click="s.redo()">↷ 重做</button>
      <button class="nb-btn sm green" :disabled="!s.ruleCount" @click="s.setAllEnabled(true)">全部启用</button>
      <button class="nb-btn sm" :disabled="!s.ruleCount" @click="s.setAllEnabled(false)">全部关闭</button>
    </div>

    <div v-if="s.brokenRules.length" class="nb-card red rl-broken">
      <div class="nb-card-title">⚠ 有 {{ s.brokenRules.length }} 条规则未命中</div>
      <p class="nb-hint" style="color: #111">网页可能改版了。可以让 AI 根据新结构修复，或者在规则上点「重选」。</p>
      <div class="nb-row" style="margin-top: 8px">
        <button class="nb-btn sm" :disabled="!s.aiReady || s.aiBusy" @click="aiRepair">🤖 AI 智能修复</button>
      </div>
    </div>

    <div v-if="!s.pageDecos.length" class="nb-empty">
      这个页面还没有装修～<br />去「AI装修」或「预设」开始吧！
    </div>

    <div v-for="d in s.pageDecos" :key="d.id" class="nb-card rl-deco" :class="{ off: !d.enabled }">
      <div class="nb-row between">
        <div class="rl-deco-name">
          <input
            v-if="renaming === d.id"
            v-model="renameText"
            class="nb-input sm"
            @keydown.enter="doRename(d.id)"
            @blur="doRename(d.id)"
          />
          <b v-else :title="'双击重命名'" @dblclick="startRename(d.id, d.name)">{{ d.name }}</b>
          <span class="nb-badge" :class="d.pathPattern === '/*' ? 'blue' : 'pink'">{{ scopeLabel(d.pathPattern) }}</span>
          <span class="nb-badge">{{ d.rules.length }} 条</span>
        </div>
        <label class="nb-switch" title="启用 / 停用整套装修">
          <input type="checkbox" :checked="d.enabled" @change="s.toggleDeco(d.id, ($event.target as HTMLInputElement).checked)" />
          <span></span>
        </label>
      </div>

      <div class="rl-rules">
        <div v-for="r in d.rules" :key="r.id" class="rl-rule" :class="{ off: !r.enabled }">
          <div class="rl-rule-main">
            <label class="nb-switch sm">
              <input type="checkbox" :checked="r.enabled" @change="s.toggleRule(r.id, ($event.target as HTMLInputElement).checked)" />
              <span></span>
            </label>
            <div class="rl-rule-info">
              <div class="rl-rule-title">
                <span class="nb-badge" :class="SOURCE[r.source].cls">{{ SOURCE[r.source].label }}</span>
                <span v-if="r.action === 'remove'" class="nb-badge red" title="该规则会把命中元素从页面移除，停用或撤销即可还原">🗑 删除</span>
                <span class="rl-note">{{ r.note || r.selector }}</span>
              </div>
              <code class="rl-sel" :title="r.selector">{{ r.selector }}</code>
              <div class="rl-sum">{{ summary(r) }}</div>
              <div class="nb-row wrap rl-flags">
                <span v-if="hitOf(r.id) === undefined" class="nb-badge">…</span>
                <span v-else-if="hitOf(r.id)! > 0" class="nb-badge green">命中 {{ hitOf(r.id) }}</span>
                <span v-else-if="r.source === 'preset'" class="nb-badge" title="预设规则是通用规则，页面上没有对应元素很正常">无对应元素</span>
                <span v-else class="nb-badge red">未命中</span>
                <span v-if="conflicts.get(r.id)" class="nb-badge yellow" :title="'与其它规则同时设置了 ' + conflicts.get(r.id)!.join(', ')">
                  冲突 {{ conflicts.get(r.id)!.length }}
                </span>
              </div>
            </div>
          </div>
          <div class="nb-row rl-ops">
            <button class="nb-btn sm" @click="editing = editing === r.id ? null : r.id">编辑</button>
            <button v-if="hitOf(r.id) === 0 && r.source !== 'preset'" class="nb-btn sm yellow" @click="reselect(r)">重选</button>
            <button class="nb-btn sm red" @click="s.deleteRule(r.id)">删除</button>
          </div>
          <RuleEditor v-if="editing === r.id" :rule="r" @close="editing = null" />
        </div>
      </div>
      <div class="nb-row" style="margin-top: 8px">
        <button class="nb-btn sm" @click="startRename(d.id, d.name)">重命名</button>
        <button class="nb-btn sm red" @click="s.deleteDeco(d.id)">删除这套装修</button>
      </div>
    </div>

    <template v-if="s.decorations.length">
      <div class="nb-sep"></div>
      <div v-if="!confirmKind" class="nb-row wrap">
        <button class="nb-btn sm red" @click="confirmKind = 'page'">删除当前页面装修</button>
        <button class="nb-btn sm red" @click="confirmKind = 'site'">删除整个站点装修</button>
      </div>
      <div v-else class="nb-card red nb-pop">
        <b>{{ confirmKind === 'page' ? '确定删除当前页面专属的装修？' : `确定删除 ${s.host} 的全部装修？` }}</b>
        <p class="nb-hint" style="color: #111">删除后可以用「撤销」找回。</p>
        <div class="nb-row" style="margin-top: 8px">
          <button class="nb-btn sm black" @click="doDelete">确定删除</button>
          <button class="nb-btn sm" @click="confirmKind = null">取消</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rl {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rl-deco.off {
  background: #eee;
}
.rl-deco-name {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}
.rl-rules {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.rl-rule {
  padding: 8px;
  background: var(--cream);
  border: 2.5px solid var(--ink);
  border-radius: 8px;
}
.rl-rule.off {
  opacity: 0.55;
}
.rl-rule-main {
  display: flex;
  gap: 8px;
}
.rl-rule-info {
  flex: 1;
  min-width: 0;
}
.rl-rule-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 800;
  font-size: 13px;
}
.rl-note {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-sel {
  display: block;
  margin-top: 3px;
  font: 700 11px/1.3 var(--mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-sum {
  font: 11px/1.3 var(--mono);
  color: #444;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rl-flags {
  margin-top: 4px;
  gap: 4px;
}
.rl-ops {
  margin-top: 8px;
  justify-content: flex-end;
}
.nb-switch.sm {
  width: 38px;
  height: 22px;
}
.nb-switch.sm span::after {
  width: 13px;
  height: 13px;
}
.nb-switch.sm input:checked + span::after {
  transform: translateX(16px);
}
</style>
