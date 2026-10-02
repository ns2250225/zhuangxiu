<script setup lang="ts">
import { computed } from 'vue';
import { useStudio } from './store';
import { usePicker } from './usePicker';
import MascotWidget from './components/MascotWidget.vue';
import Panel from './components/Panel.vue';
import { describeElement } from '@/lib/selector-engine';

const s = useStudio();
const { hoverBox, selBoxes } = usePicker();

const showMascot = computed(() => s.settings.mascotEnabled && !s.mascotHidden);
const hoverLabel = computed(() => (s.hovered ? describeElement(s.hovered) : ''));
const px = (n: number) => `${Math.round(n)}px`;
</script>

<template>
  <div class="nb ps-root">
    <!-- 元素选择高亮层 -->
    <div
      v-for="(b, i) in selBoxes"
      :key="'sel' + i"
      class="ps-box ps-box-sel"
      :style="{ top: px(b.top), left: px(b.left), width: px(b.width), height: px(b.height) }"
    >
      <span class="ps-box-num">{{ i + 1 }}</span>
    </div>
    <div
      v-if="hoverBox"
      class="ps-box ps-box-hover"
      :style="{ top: px(hoverBox.top), left: px(hoverBox.left), width: px(hoverBox.width), height: px(hoverBox.height) }"
    >
      <span class="ps-box-tag" :class="{ below: hoverBox.top < 28 }">
        {{ hoverLabel }} · {{ Math.round(hoverBox.width) }}×{{ Math.round(hoverBox.height) }}
      </span>
    </div>

    <!-- 选择模式提示条 -->
    <div v-if="s.picking" class="ps-pickbar nb-pop">
      <span class="nb-badge pink">选元素</span>
      <b>已选 {{ s.selected.length }}</b>
      <span class="ps-keys">点击选中 · <kbd>Shift</kbd> 多选 · <kbd>Alt</kbd> 取消 · <kbd>↑</kbd>/<kbd>↓</kbd> 父/子 · <kbd>Esc</kbd> 退出</span>
      <button class="nb-btn sm green" @click="s.stopPicker()">完成选择</button>
    </div>

    <!-- 预览条 -->
    <div v-if="s.preview && (!s.panelOpen || s.panelCollapsed) && !s.picking" class="ps-previewbar nb-pop">
      <span class="nb-badge yellow">PREVIEW</span>
      <b class="ps-ellipsis">{{ s.preview.label }}</b>
      <button class="nb-btn sm green" @click="s.adoptPreview()">采用</button>
      <button class="nb-btn sm" @click="s.cancelPreview()">取消</button>
      <button class="nb-btn sm blue" @click="(s.panelOpen = true), (s.panelCollapsed = false)">继续调整</button>
    </div>

    <Panel v-if="s.panelOpen" />
    <MascotWidget v-if="showMascot" />

    <div class="ps-toasts">
      <div v-for="t in s.toasts" :key="t.id" class="ps-toast nb-pop" :class="t.kind">{{ t.text }}</div>
    </div>
  </div>
</template>

<style>
.ps-root {
  position: fixed;
  inset: 0 auto auto 0;
  width: 0;
  height: 0;
  z-index: 2147483646;
}
.ps-box {
  position: fixed;
  pointer-events: none;
  z-index: 2147483640;
  border-radius: 4px;
}
.ps-box-hover {
  outline: 3px dashed #ff7ad9;
  background: rgba(255, 122, 217, 0.14);
  transition: all 0.06s linear;
}
.ps-box-sel {
  outline: 3px solid #111;
  box-shadow: 0 0 0 6px rgba(89, 167, 255, 0.55);
  background: rgba(89, 167, 255, 0.12);
}
.ps-box-num {
  position: absolute;
  top: -12px;
  left: -12px;
  width: 22px;
  height: 22px;
  display: grid;
  place-items: center;
  font: 900 12px/1 var(--font);
  background: #59a7ff;
  border: 2.5px solid #111;
  border-radius: 50%;
}
.ps-box-tag {
  position: absolute;
  top: -28px;
  left: -3px;
  padding: 2px 8px;
  font: 800 12px/18px var(--mono);
  color: #111;
  background: #ff7ad9;
  border: 2.5px solid #111;
  border-radius: 6px;
  white-space: nowrap;
}
.ps-box-tag.below {
  top: auto;
  bottom: -28px;
}
.ps-pickbar,
.ps-previewbar {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - 32px);
  padding: 8px 10px 8px 12px;
  background: #fff;
  border: 3px solid #111;
  border-radius: 12px;
  box-shadow: 5px 5px 0 #111;
  z-index: 2147483645;
}
.ps-pickbar {
  top: 14px;
  background: #ffd84d;
}
.ps-previewbar {
  bottom: 18px;
}
.ps-pickbar.nb-pop,
.ps-previewbar.nb-pop {
  animation: none;
}
.ps-keys {
  font-size: 12px;
  font-weight: 600;
}
.ps-keys kbd {
  font: 800 11px/1 var(--mono);
  padding: 2px 5px;
  background: #fff;
  border: 2px solid #111;
  border-radius: 4px;
}
.ps-ellipsis {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ps-toasts {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 2147483647;
  pointer-events: none;
}
.ps-toast {
  padding: 8px 14px;
  font-weight: 800;
  font-size: 13px;
  background: #fff;
  border: 3px solid #111;
  border-radius: 10px;
  box-shadow: 4px 4px 0 #111;
  max-width: 420px;
}
.ps-toast.ok { background: #7dff8a; }
.ps-toast.err { background: #ff6b57; }
.ps-toast.info { background: #ffd84d; }
</style>
