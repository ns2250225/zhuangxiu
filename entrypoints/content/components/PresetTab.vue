<script setup lang="ts">
import { ref, watch } from 'vue';
import { useStudio, type Scope } from '../store';
import { PRESETS, type Preset } from '@/lib/presets';
import ScopeSwitch from './ScopeSwitch.vue';

const s = useStudio();
const scope = ref<Scope>('site');
const current = ref<Preset | null>(null);

function tryOn(p: Preset) {
  current.value = p;
  s.previewPreset(p, scope.value);
}
watch(scope, () => current.value && s.preview?.kind === 'preset' && s.previewPreset(current.value, scope.value));
watch(
  () => s.preview,
  (v) => {
    if (!v || v.kind !== 'preset') current.value = null;
  },
);
async function apply(p: Preset) {
  if (!(s.preview?.kind === 'preset' && current.value?.id === p.id)) s.previewPreset(p, scope.value);
  await s.adoptPreview(`已应用「${p.name}」主题 🎉`);
  current.value = null;
}
</script>

<template>
  <div class="pre">
    <div class="nb-card yellow">
      <div class="nb-card-title">🧩 一键套用主题</div>
      <p class="nb-hint">点卡片即可预览，满意再应用。预设会和你的 AI / 手动规则叠加，后者优先。</p>
      <ScopeSwitch v-model="scope" :path="s.path" style="margin-top: 8px" />
    </div>

    <div class="pre-grid">
      <div
        v-for="p in PRESETS"
        :key="p.id"
        class="pre-card"
        :class="{ on: current?.id === p.id, active: s.activePresetIds.has(p.id) }"
        @click="tryOn(p)"
      >
        <div class="pre-swatch">
          <span v-for="c in p.swatch" :key="c" :style="{ background: c }"></span>
        </div>
        <div class="pre-name">
          <span>{{ p.emoji }}</span>{{ p.name }}
          <span v-if="s.activePresetIds.has(p.id)" class="nb-badge green">ON</span>
        </div>
        <div class="pre-desc">{{ p.desc }}</div>
        <div v-if="current?.id === p.id" class="nb-row pre-act" @click.stop>
          <button class="nb-btn sm green" @click="apply(p)">应用</button>
          <button class="nb-btn sm" @click="s.cancelPreview()">取消</button>
        </div>
      </div>
    </div>

    <button v-if="s.activePresetIds.size" class="nb-btn sm red block" @click="s.removePresets()">移除已应用的预设主题</button>
  </div>
</template>

<style scoped>
.pre {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pre-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.pre-card {
  padding: 8px;
  background: #fff;
  border: 3px solid var(--ink);
  border-radius: 10px;
  box-shadow: 4px 4px 0 var(--ink);
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s;
}
.pre-card:hover {
  transform: translate(-2px, -2px) rotate(-0.6deg);
  box-shadow: 6px 6px 0 var(--ink);
}
.pre-card.on {
  background: var(--yellow);
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0 var(--ink);
}
.pre-card.active {
  outline: 3px dashed var(--green);
  outline-offset: -8px;
}
.pre-swatch {
  display: flex;
  height: 30px;
  border: 2.5px solid var(--ink);
  border-radius: 6px;
  overflow: hidden;
}
.pre-swatch span {
  flex: 1;
}
.pre-swatch span + span {
  border-left: 2px solid var(--ink);
}
.pre-name {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-weight: 900;
  font-size: 13.5px;
}
.pre-desc {
  font-size: 11.5px;
  font-weight: 600;
  color: #333;
  margin-top: 2px;
}
.pre-act {
  margin-top: 8px;
}
</style>
