<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useStudio, type Scope } from '../store';
import ScopeSwitch from './ScopeSwitch.vue';
import { uid } from '@/lib/utils';
import { sanitizeStyles } from '@/lib/css-sanitize';

const props = defineProps<{ selector: string }>();
const s = useStudio();
const scope = ref<Scope>('site');
const st = reactive<Record<string, string>>({});
const group = ref<'base' | 'font' | 'layout' | 'show'>('base');

const COLORS: Array<[string, string]> = [
  ['backgroundColor', '背景色'],
  ['color', '文字颜色'],
  ['borderColor', '边框颜色'],
];
const SHADOWS = [
  ['', '不改'],
  ['none', '无阴影'],
  ['4px 4px 0 #111111', '硬阴影 S'],
  ['8px 8px 0 #111111', '硬阴影 L'],
  ['6px 6px 0 #FF7AD9', '粉色硬阴影'],
  ['0 6px 20px rgba(0,0,0,0.15)', '柔和阴影'],
];
const PALETTE = ['#FFD84D', '#FF7AD9', '#59A7FF', '#7DFF8A', '#FF6B57', '#FFFFFF', '#111111'];

const px = (k: string) =>
  computed({
    get: () => (st[k] ? parseFloat(st[k]) : ('' as unknown as number)),
    set: (v: number | string) => (st[k] = v === '' || v === null || Number.isNaN(Number(v)) ? '' : `${v}px`),
  });
const borderWidth = px('borderWidth');
const borderRadius = px('borderRadius');
const fontSize = px('fontSize');
const opacity = computed({
  get: () => (st.opacity ? Number(st.opacity) : 1),
  set: (v: number) => (st.opacity = Number(v) >= 1 ? '' : String(v)),
});

const styles = computed(() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(st)) if (v !== '' && v != null) out[k] = String(v);
  if (out.borderWidth && !out.borderStyle) out.borderStyle = 'solid';
  return sanitizeStyles(out).styles;
});
const count = computed(() => Object.keys(styles.value).length);

watch(
  [styles, scope, () => props.selector],
  () => {
    if (!props.selector) return;
    if (count.value) {
      s.previewAddRules(
        [{ id: uid('man'), selector: props.selector, styles: styles.value, enabled: true, source: 'manual', priority: 0, note: '手动装修' }],
        scope.value,
        'manual',
        '手动装修',
      );
    } else if (s.preview?.kind === 'manual') s.cancelPreview();
  },
  { deep: true },
);

function set(patch: Record<string, string>) {
  Object.assign(st, patch);
}
function toggle(patch: Record<string, string>) {
  const on = Object.entries(patch).every(([k, v]) => st[k] === v);
  for (const [k, v] of Object.entries(patch)) st[k] = on ? '' : v;
}
const isOn = (patch: Record<string, string>) => Object.entries(patch).every(([k, v]) => st[k] === v);

const QUICK = {
  thick: { border: '4px solid #111111' },
  hard: { boxShadow: '6px 6px 0 #111111' },
  card: () => ({
    backgroundColor: PALETTE[Math.floor(Math.random() * 5)] ?? '#FFD84D',
    border: '3px solid #111111',
    borderRadius: '10px',
    boxShadow: '6px 6px 0 #111111',
    color: '#111111',
  }),
  fierce: {
    backgroundColor: '#FF6B57',
    color: '#111111',
    border: '3px solid #111111',
    borderRadius: '8px',
    boxShadow: '4px 4px 0 #111111',
    fontWeight: '900',
    padding: '10px 18px',
    textTransform: 'uppercase',
  },
};
const HIDE = { display: 'none' };
const EMPH = { outline: '3px solid #FF6B57', outlineOffset: '3px', boxShadow: '0 0 0 8px rgba(255,107,87,0.25)' };
const DIM = { opacity: '0.35' };

function reset() {
  for (const k of Object.keys(st)) delete st[k];
}
async function save() {
  if (!count.value) return;
  if (s.preview?.kind !== 'manual') return;
  await s.adoptPreview('手动装修已保存 🖌');
  reset();
}
async function removeElement() {
  if (!props.selector) return;
  await s.addRulesNow(
    [
      {
        id: uid('man'),
        selector: props.selector,
        styles: {},
        action: 'remove',
        enabled: true,
        source: 'manual',
        priority: 0,
        note: '删除元素',
      },
    ],
    scope.value,
    '元素已删除，撤销或停用该规则即可恢复 🗑',
  );
  reset();
}
</script>

<template>
  <div class="man nb-card">
    <div class="nb-card-title">🖌 手动装修 <span v-if="count" class="nb-badge yellow">{{ count }} 项 · 实时预览</span></div>

    <div class="man-quick">
      <span class="nb-label">Neo Brutalism 快捷</span>
      <div class="nb-row wrap">
        <button class="nb-btn sm yellow" @click="set(QUICK.thick)">一键加粗边框</button>
        <button class="nb-btn sm pink" @click="set(QUICK.hard)">一键硬阴影</button>
        <button class="nb-btn sm blue" @click="set(QUICK.card())">撞色卡片</button>
        <button class="nb-btn sm red" @click="set(QUICK.fierce)">按钮变狠</button>
      </div>
    </div>

    <div class="nb-tabs man-tabs">
      <button class="nb-tab" :class="{ active: group === 'base' }" @click="group = 'base'">基础</button>
      <button class="nb-tab" :class="{ active: group === 'font' }" @click="group = 'font'">字体</button>
      <button class="nb-tab" :class="{ active: group === 'layout' }" @click="group = 'layout'">布局</button>
      <button class="nb-tab" :class="{ active: group === 'show' }" @click="group = 'show'">显示</button>
    </div>

    <div v-if="group === 'base'" class="man-grid">
      <div v-for="[k, label] in COLORS" :key="k" class="man-color">
        <span class="nb-label">{{ label }}</span>
        <div class="nb-row">
          <input type="color" class="nb-color" :value="st[k] && st[k].startsWith('#') ? st[k].slice(0, 7) : '#ffffff'" @input="st[k] = ($event.target as HTMLInputElement).value" />
          <input v-model="st[k]" class="nb-input sm mono" placeholder="不改" />
        </div>
        <div class="man-dots">
          <button v-for="c in PALETTE" :key="c" :style="{ background: c }" :title="c" @click="st[k] = c"></button>
        </div>
      </div>
      <div>
        <span class="nb-label">边框粗细 (px)</span>
        <input v-model="borderWidth" type="number" min="0" max="20" class="nb-input sm" placeholder="不改" />
      </div>
      <div>
        <span class="nb-label">圆角 (px)</span>
        <input v-model="borderRadius" type="number" min="0" max="100" class="nb-input sm" placeholder="不改" />
      </div>
      <div>
        <span class="nb-label">阴影</span>
        <select v-model="st.boxShadow" class="nb-select sm">
          <option v-for="[v, l] in SHADOWS" :key="l" :value="v">{{ l }}</option>
        </select>
      </div>
      <div>
        <span class="nb-label">透明度 {{ opacity }}</span>
        <input v-model.number="opacity" type="range" min="0.1" max="1" step="0.05" class="nb-range" />
      </div>
    </div>

    <div v-else-if="group === 'font'" class="man-grid">
      <div>
        <span class="nb-label">字号 (px)</span>
        <input v-model="fontSize" type="number" min="8" max="96" class="nb-input sm" placeholder="不改" />
      </div>
      <div>
        <span class="nb-label">字重</span>
        <select v-model="st.fontWeight" class="nb-select sm">
          <option value="">不改</option>
          <option v-for="w in ['300', '400', '500', '600', '700', '800', '900']" :key="w" :value="w">{{ w }}</option>
        </select>
      </div>
      <div>
        <span class="nb-label">行高</span>
        <input v-model="st.lineHeight" class="nb-input sm" placeholder="如 1.6" />
      </div>
      <div>
        <span class="nb-label">对齐</span>
        <select v-model="st.textAlign" class="nb-select sm">
          <option value="">不改</option>
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
          <option value="justify">两端对齐</option>
        </select>
      </div>
      <div class="span2">
        <span class="nb-label">字体</span>
        <select v-model="st.fontFamily" class="nb-select sm">
          <option value="">不改</option>
          <option value="system-ui, sans-serif">系统无衬线</option>
          <option value="Georgia, 'Songti SC', serif">衬线</option>
          <option value="'JetBrains Mono', Menlo, monospace">等宽</option>
          <option value="'Arial Black', 'PingFang SC', sans-serif">超粗黑</option>
        </select>
      </div>
    </div>

    <div v-else-if="group === 'layout'" class="man-grid">
      <div v-for="[k, label] in [['width', '宽度'], ['height', '高度'], ['padding', '内边距'], ['margin', '外边距'], ['gap', '间距'], ['maxWidth', '最大宽度']]" :key="k">
        <span class="nb-label">{{ label }}</span>
        <input v-model="st[k]" class="nb-input sm mono" placeholder="如 16px / auto / 50%" />
      </div>
    </div>

    <div v-else class="man-show">
      <button class="nb-btn sm" :class="{ black: isOn(HIDE) }" @click="toggle(HIDE)">🙈 {{ isOn(HIDE) ? '已隐藏' : '隐藏' }}</button>
      <button class="nb-btn sm" :class="{ red: isOn(EMPH) }" @click="toggle(EMPH)">📣 强调</button>
      <button class="nb-btn sm" :class="{ blue: isOn(DIM) }" @click="toggle(DIM)">🌫 降低透明度</button>
    </div>

    <div class="nb-sep"></div>
    <ScopeSwitch v-model="scope" :path="s.path" />
    <div class="nb-row" style="margin-top: 10px">
      <button class="nb-btn green" :disabled="!count" @click="save">保存装修</button>
      <button class="nb-btn" :disabled="!count" @click="reset">重置</button>
      <button class="nb-btn red" @click="removeElement">🗑 删除该元素</button>
    </div>
  </div>
</template>

<style scoped>
.man-quick {
  margin-bottom: 10px;
}
.man-tabs {
  margin-bottom: 10px;
}
.man-tabs .nb-tab {
  padding: 6px 10px;
  font-size: 12px;
}
.man-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.man-color {
  grid-column: span 2;
}
.span2 {
  grid-column: span 2;
}
.man-dots {
  display: flex;
  gap: 5px;
  margin-top: 5px;
}
.man-dots button {
  width: 18px;
  height: 18px;
  border: 2px solid var(--ink);
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
.man-dots button:hover {
  transform: scale(1.2) rotate(-6deg);
}
.man-show {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
