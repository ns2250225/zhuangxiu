<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useStudio } from '../store';
import type { DecorationRule } from '@/lib/types';
import { sanitizeSelector, sanitizeStyles } from '@/lib/css-sanitize';
import { camel, kebab, throttle } from '@/lib/utils';

const props = defineProps<{ rule: DecorationRule }>();
const emit = defineEmits<{ close: [] }>();
const s = useStudio();

const selector = ref(props.rule.selector);
const note = ref(props.rule.note ?? '');
const priority = ref(props.rule.priority);
const rows = ref(Object.entries(props.rule.styles).map(([k, v]) => ({ k: kebab(k), v })));
const error = ref('');

function collect() {
  const raw: Record<string, string> = {};
  for (const r of rows.value) if (r.k.trim() && r.v.trim()) raw[camel(r.k.trim())] = r.v.trim();
  const { styles, dropped } = sanitizeStyles(raw);
  const sel = sanitizeSelector(selector.value);
  error.value = !sel ? '选择器不合法' : dropped.length ? `已忽略：${dropped.join('，')}` : '';
  return { sel, styles };
}

const livePreview = throttle(() => {
  const { sel, styles } = collect();
  if (sel) s.previewRuleEdit(props.rule.id, { selector: sel, styles, enabled: true });
}, 250);
watch([selector, rows], livePreview, { deep: true });

async function save() {
  const { sel, styles } = collect();
  if (!sel) return;
  await s.updateRule(props.rule.id, {
    selector: sel,
    styles,
    note: note.value.trim() || undefined,
    priority: Number(priority.value) || 0,
    enabled: true,
  });
  emit('close');
}
function cancel() {
  if (s.preview?.kind === 'edit') s.cancelPreview();
  emit('close');
}
onBeforeUnmount(() => {
  if (s.preview?.kind === 'edit') s.cancelPreview();
});
</script>

<template>
  <div class="re nb-pop">
    <div class="nb-grid-2">
      <div class="span2">
        <span class="nb-label">选择器</span>
        <input v-model="selector" class="nb-input sm mono" />
      </div>
      <div>
        <span class="nb-label">说明</span>
        <input v-model="note" class="nb-input sm" placeholder="这条规则做什么" />
      </div>
      <div>
        <span class="nb-label">优先级（越大越靠后生效）</span>
        <input v-model.number="priority" type="number" class="nb-input sm" />
      </div>
    </div>
    <span class="nb-label" style="margin-top: 10px">样式</span>
    <div v-for="(r, i) in rows" :key="i" class="re-row">
      <input v-model="r.k" class="nb-input sm mono" placeholder="属性 如 background-color" />
      <input v-model="r.v" class="nb-input sm mono" placeholder="值 如 #FFD84D" />
      <button class="nb-btn sm icon" @click="rows.splice(i, 1)">−</button>
    </div>
    <button class="nb-btn sm" @click="rows.push({ k: '', v: '' })">＋ 添加样式</button>
    <div v-if="error" class="re-err">{{ error }}</div>
    <div class="nb-row" style="margin-top: 10px">
      <button class="nb-btn sm green" @click="save">保存</button>
      <button class="nb-btn sm" @click="cancel">取消</button>
      <span class="nb-hint">编辑中实时预览</span>
    </div>
  </div>
</template>

<style scoped>
.re {
  margin-top: 8px;
  padding: 10px;
  background: #fff;
  border: 2.5px dashed var(--ink);
  border-radius: 8px;
}
.span2 {
  grid-column: span 2;
}
.re-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 6px;
  margin-bottom: 6px;
}
.re-row .nb-btn.icon {
  width: 28px;
  min-height: 28px;
}
.re-err {
  margin-top: 6px;
  font-size: 12px;
  font-weight: 700;
  color: #c0301c;
}
</style>
