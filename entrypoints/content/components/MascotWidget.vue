<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Mascot from '@/components/Mascot.vue';
import { useStudio } from '../store';
import { mascotPosItem } from '@/lib/storage';
import type { MascotPosition } from '@/lib/types';

const s = useStudio();
const pos = ref<MascotPosition>({ side: 'right', top: 0.78, minimized: false });
const drag = ref<{ x: number; y: number } | null>(null);
const menuOpen = ref(false);
const hover = ref(false);
const bubble = ref(false);
const vh = ref(window.innerHeight);
const vw = ref(window.innerWidth);

const size = computed(() => s.settings.mascotSize || 72);
const EDGE = 14;

const wrap = ref<HTMLElement | null>(null);
const closeOutside = (e: PointerEvent) => {
  if (menuOpen.value && wrap.value && !e.composedPath().includes(wrap.value)) menuOpen.value = false;
};
onMounted(async () => {
  pos.value = { ...pos.value, ...(await mascotPosItem.getValue()) };
  window.addEventListener('resize', onResize);
  window.addEventListener('pointerdown', closeOutside, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('pointerdown', closeOutside, true);
});
const onResize = () => {
  vh.value = window.innerHeight;
  vw.value = window.innerWidth;
};

const style = computed(() => {
  const sz = size.value;
  if (drag.value) return { left: `${drag.value.x - sz / 2}px`, top: `${drag.value.y - sz / 2}px` };
  const top = Math.min(Math.max(pos.value.top * vh.value - sz / 2, 8), vh.value - sz - 8);
  // 面板打开时让出位置，站到面板旁边
  const besidePanel = s.panelOpen && pos.value.side === s.settings.panelSide;
  const panelW = s.panelCollapsed ? 250 : Math.min(400, vw.value - 24);
  const off = besidePanel
    ? `${12 + panelW + 10}px`
    : pos.value.minimized
      ? `${-sz * 0.42}px`
      : `${EDGE}px`;
  return pos.value.side === 'right' ? { right: off, top: `${top}px` } : { left: off, top: `${top}px` };
});

// 状态变化时自动冒泡提示
let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => s.mascotState,
  (st) => {
    if (st === 'success' || st === 'warning' || st === 'thinking') {
      bubble.value = true;
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => (bubble.value = false), 2600);
    }
  },
);

/* ---------- 拖动 / 单击 / 长按 ---------- */
let start: { x: number; y: number; t: number } | null = null;
let longTimer: ReturnType<typeof setTimeout> | undefined;
let longFired = false;

function onDown(e: PointerEvent) {
  if (e.button !== 0) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  start = { x: e.clientX, y: e.clientY, t: Date.now() };
  longFired = false;
  clearTimeout(longTimer);
  longTimer = setTimeout(() => {
    longFired = true;
    menuOpen.value = true;
  }, 520);
}
function onMove(e: PointerEvent) {
  if (!start) return;
  if (!drag.value && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
    clearTimeout(longTimer);
    menuOpen.value = false;
  }
  if (drag.value || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
    drag.value = { x: e.clientX, y: e.clientY };
  }
}
async function onUp(e: PointerEvent) {
  clearTimeout(longTimer);
  if (!start) return;
  if (drag.value) {
    // 贴边吸附
    const side = e.clientX < vw.value / 2 ? 'left' : 'right';
    pos.value = { side, top: Math.min(Math.max(e.clientY / vh.value, 0.05), 0.95), minimized: false };
    drag.value = null;
    await mascotPosItem.setValue({ ...pos.value });
  } else if (!longFired) {
    if (pos.value.minimized) {
      pos.value = { ...pos.value, minimized: false };
      await mascotPosItem.setValue({ ...pos.value });
    } else if (menuOpen.value) menuOpen.value = false;
    else togglePanel();
  }
  start = null;
}
function onContext(e: MouseEvent) {
  e.preventDefault();
  menuOpen.value = !menuOpen.value;
}

function togglePanel() {
  s.panelOpen = !s.panelOpen;
  s.panelCollapsed = false;
}
function openTab(tab: typeof s.panelTab) {
  s.panelOpen = true;
  s.panelCollapsed = false;
  s.panelTab = tab;
  menuOpen.value = false;
}
async function minimize() {
  pos.value = { ...pos.value, minimized: true };
  menuOpen.value = false;
  await mascotPosItem.setValue({ ...pos.value });
}

const menu = computed(() => [
  { icon: '🎨', label: '打开装修师', run: () => openTab('ai') },
  {
    icon: s.paused ? '✨' : '👀',
    label: s.paused ? '恢复装修' : '显示原样',
    run: () => {
      s.toggleOriginal();
      menuOpen.value = false;
    },
  },
  {
    icon: '🎯',
    label: '选择元素',
    run: () => {
      s.startPicker();
      menuOpen.value = false;
    },
  },
  { icon: '🧩', label: '预设主题', run: () => openTab('preset') },
  { icon: '🔗', label: '分享装修码', run: () => openTab('code') },
  { icon: '➖', label: '缩到边上', run: minimize },
  {
    icon: '🙈',
    label: '在本站隐藏',
    run: () => {
      menuOpen.value = false;
      s.hideMascot();
    },
  },
]);

const STATE_COLOR: Record<string, string> = {
  idle: '#ffffff',
  thinking: '#59a7ff',
  decorating: '#ff7ad9',
  success: '#7dff8a',
  paused: '#dddddd',
  warning: '#ff6b57',
};
</script>

<template>
  <div
    ref="wrap"
    class="ps-mascot-wrap"
    :class="[`side-${pos.side}`, { dragging: drag, minimized: pos.minimized && !drag && !s.panelOpen }]"
    :style="style"
    @mouseenter="hover = true"
    @mouseleave="hover = false"
  >
    <div
      class="ps-mascot-btn"
      :title="s.statusText"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="(drag = null), (start = null)"
      @contextmenu="onContext"
    >
      <Mascot :state="s.mascotState" :skin="s.settings.mascotSkin" :form="s.settings.mascotForm" :size="size" />
      <span v-if="s.decorated && !pos.minimized" class="ps-mascot-count" :class="{ off: s.paused }">
        {{ s.paused ? 'OFF' : s.savedRules.length }}
      </span>
    </div>

    <div
      v-if="(hover || bubble) && !menuOpen && !drag && !pos.minimized"
      class="ps-bubble nb-pop"
      :style="{ background: STATE_COLOR[s.mascotState] }"
    >
      {{ s.statusText }}
    </div>

    <div v-if="menuOpen" class="ps-menu nb-pop" @pointerdown.stop>
      <div class="ps-menu-head">
        <b>PageStyler</b>
        <button class="ps-x" @click="menuOpen = false">×</button>
      </div>
      <button v-for="m in menu" :key="m.label" class="ps-menu-item" @click="m.run()">
        <span>{{ m.icon }}</span>{{ m.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.ps-mascot-wrap {
  position: fixed;
  z-index: 2147483646;
  transition: right 0.25s cubic-bezier(0.3, 1.4, 0.6, 1), left 0.25s cubic-bezier(0.3, 1.4, 0.6, 1);
}
.ps-mascot-wrap.dragging {
  transition: none;
}
.ps-mascot-btn {
  position: relative;
  cursor: grab;
  touch-action: none;
  user-select: none;
  filter: drop-shadow(0 0 0 transparent);
  transition: transform 0.12s;
}
.ps-mascot-btn:hover {
  transform: scale(1.06) rotate(-3deg);
}
.dragging .ps-mascot-btn {
  cursor: grabbing;
  transform: scale(1.12) rotate(6deg);
}
.minimized .ps-mascot-btn {
  opacity: 0.85;
}
.side-right.minimized .ps-mascot-btn {
  transform: rotate(-18deg);
}
.side-left.minimized .ps-mascot-btn {
  transform: rotate(18deg);
}
.ps-mascot-count {
  position: absolute;
  top: 18%;
  left: -6px;
  min-width: 22px;
  height: 22px;
  padding: 0 5px;
  display: grid;
  place-items: center;
  font: 900 11px/1 var(--font);
  background: #7dff8a;
  border: 2.5px solid #111;
  border-radius: 999px;
  box-shadow: 2px 2px 0 #111;
}
.ps-mascot-count.off {
  background: #ddd;
}
.ps-bubble {
  position: absolute;
  bottom: calc(100% + 6px);
  padding: 6px 10px;
  font-weight: 800;
  font-size: 12px;
  white-space: nowrap;
  border: 2.5px solid #111;
  border-radius: 10px;
  box-shadow: 3px 3px 0 #111;
  pointer-events: none;
}
.side-right .ps-bubble {
  right: 0;
}
.side-left .ps-bubble {
  left: 0;
}
.ps-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  width: 176px;
  padding: 6px;
  background: #fff8e1;
  border: 3px solid #111;
  border-radius: 12px;
  box-shadow: 5px 5px 0 #111;
}
.side-right .ps-menu {
  right: 0;
}
.side-left .ps-menu {
  left: 0;
}
.ps-menu-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 6px;
  font-size: 13px;
  border-bottom: 2.5px solid #111;
  margin-bottom: 4px;
}
.ps-x {
  appearance: none;
  border: none;
  background: none;
  font: 900 18px/1 var(--font);
  cursor: pointer;
  color: #111;
}
.ps-menu-item {
  appearance: none;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  font: 700 13px/1.2 var(--font);
  color: #111;
  text-align: left;
  background: transparent;
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
}
.ps-menu-item:hover {
  background: #ffd84d;
  border-color: #111;
  transform: translateX(2px);
}
</style>
