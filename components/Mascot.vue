<script setup lang="ts">
import { computed } from 'vue';
import type { MascotForm, MascotSkin, MascotState } from '@/lib/types';

const props = withDefaults(
  defineProps<{
    state?: MascotState;
    skin?: MascotSkin;
    form?: MascotForm;
    size?: number;
    /** 关闭动画（例如在列表里展示时） */
    still?: boolean;
  }>(),
  { state: 'idle', skin: 'yellow', form: 'robot', size: 72, still: false },
);

const SKINS: Record<MascotSkin, { body: string; accent: string; cheek: string }> = {
  yellow: { body: '#FFD84D', accent: '#59A7FF', cheek: '#FF7AD9' },
  pink: { body: '#FF7AD9', accent: '#FFD84D', cheek: '#FF6B57' },
  blue: { body: '#59A7FF', accent: '#FFD84D', cheek: '#FF7AD9' },
  green: { body: '#7DFF8A', accent: '#FF7AD9', cheek: '#FF7AD9' },
};
const c = computed(() => SKINS[props.skin] ?? SKINS.yellow);
const INK = '#111111';
</script>

<template>
  <svg
    class="ps-mascot"
    :class="[`is-${state}`, { still }]"
    :width="size"
    :height="size"
    viewBox="0 0 120 120"
    role="img"
    aria-label="PageStyler 吉祥物"
  >
    <g class="m-float">
      <!-- 硬阴影 -->
      <rect x="21" y="31" width="88" height="66" rx="24" :fill="INK" />

      <!-- 形态：天线 / 猫耳 / 画家帽 -->
      <g v-if="form === 'robot'" class="m-antenna">
        <line x1="60" y1="30" x2="60" y2="13" :stroke="INK" stroke-width="4" stroke-linecap="round" />
        <circle class="m-bulb" cx="60" cy="11" r="7" :fill="state === 'thinking' ? '#FFD84D' : c.cheek" :stroke="INK" stroke-width="4" />
        <circle cx="57.5" cy="8.5" r="2" fill="#fff" />
      </g>
      <g v-else-if="form === 'cat'">
        <path d="M24 38 L28 10 L50 28 Z" :fill="c.body" :stroke="INK" stroke-width="4" stroke-linejoin="round" />
        <path d="M96 38 L92 10 L70 28 Z" :fill="c.body" :stroke="INK" stroke-width="4" stroke-linejoin="round" />
        <path d="M30 30 L31 19 L40 27 Z" :fill="c.cheek" />
        <path d="M90 30 L89 19 L80 27 Z" :fill="c.cheek" />
      </g>

      <!-- 侧边“耳朵”螺栓 -->
      <rect x="7" y="50" width="12" height="24" rx="5" :fill="c.accent" :stroke="INK" stroke-width="4" />
      <rect x="101" y="50" width="12" height="24" rx="5" :fill="c.accent" :stroke="INK" stroke-width="4" />

      <!-- 小脚丫 -->
      <rect x="34" y="88" width="20" height="14" rx="7" :fill="c.accent" :stroke="INK" stroke-width="4" />
      <rect x="66" y="88" width="20" height="14" rx="7" :fill="c.accent" :stroke="INK" stroke-width="4" />

      <!-- 身体 -->
      <rect x="16" y="26" width="88" height="66" rx="24" :fill="c.body" :stroke="INK" stroke-width="4" />
      <!-- 高光 -->
      <path d="M28 36 Q34 30 44 30" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.85" />

      <!-- 画家帽 -->
      <g v-if="form === 'painter'">
        <ellipse cx="54" cy="27" rx="32" ry="11" transform="rotate(-10 54 27)" fill="#FF6B57" :stroke="INK" stroke-width="4" />
        <circle cx="52" cy="14" r="4.5" fill="#FF6B57" :stroke="INK" stroke-width="3.5" />
        <circle cx="70" cy="26" r="3" fill="#FFD84D" />
        <circle cx="42" cy="28" r="2.5" fill="#59A7FF" />
      </g>

      <!-- 屏幕脸 -->
      <rect x="28" y="40" width="64" height="40" rx="14" :fill="INK" />

      <!-- 腮红 -->
      <ellipse cx="38" cy="70" rx="6" ry="3.6" :fill="c.cheek" opacity="0.95" />
      <ellipse cx="82" cy="70" rx="6" ry="3.6" :fill="c.cheek" opacity="0.95" />

      <!-- 眼睛 -->
      <g class="m-eyes">
        <template v-if="state === 'success'">
          <path d="M40 60 Q46 50 52 60" stroke="#7DFF8A" stroke-width="4.5" stroke-linecap="round" fill="none" />
          <path d="M68 60 Q74 50 80 60" stroke="#7DFF8A" stroke-width="4.5" stroke-linecap="round" fill="none" />
        </template>
        <template v-else-if="state === 'paused'">
          <path d="M40 58 Q46 63 52 58" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" />
          <path d="M68 58 Q74 63 80 58" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" />
        </template>
        <template v-else-if="state === 'warning'">
          <circle cx="46" cy="57" r="7.5" fill="#fff" />
          <circle cx="74" cy="57" r="7.5" fill="#fff" />
          <circle cx="46" cy="57" r="2.6" :fill="INK" />
          <circle cx="74" cy="57" r="2.6" :fill="INK" />
        </template>
        <template v-else-if="state === 'decorating'">
          <!-- 专注的星星眼 -->
          <path class="m-star-eye" d="M46 49 L48.6 54.6 L54.6 55.4 L50.2 59.4 L51.4 65.4 L46 62.4 L40.6 65.4 L41.8 59.4 L37.4 55.4 L43.4 54.6 Z" fill="#FFD84D" />
          <path class="m-star-eye" d="M74 49 L76.6 54.6 L82.6 55.4 L78.2 59.4 L79.4 65.4 L74 62.4 L68.6 65.4 L69.8 59.4 L65.4 55.4 L71.4 54.6 Z" fill="#FFD84D" />
        </template>
        <g v-else class="m-blink" :class="{ 'look-up': state === 'thinking' }">
          <rect x="40" y="50" width="11" height="15" rx="5.5" fill="#fff" />
          <rect x="69" y="50" width="11" height="15" rx="5.5" fill="#fff" />
          <circle cx="47.5" cy="54" r="2.2" :fill="INK" opacity="0.25" />
          <circle cx="76.5" cy="54" r="2.2" :fill="INK" opacity="0.25" />
        </g>
      </g>

      <!-- 嘴巴 -->
      <path
        v-if="state === 'success'"
        d="M53 67 Q60 77 67 67 Z"
        fill="#FF7AD9"
        stroke="#FF7AD9"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <ellipse v-else-if="state === 'warning'" cx="60" cy="71" rx="3.5" ry="3" fill="#fff" />
      <ellipse v-else-if="state === 'thinking'" cx="63" cy="71" rx="2.6" ry="2.2" fill="#fff" />
      <path v-else d="M54 68 Q57 72 60 68 Q63 72 66 68" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none" />

      <!-- 状态小道具 -->
      <g v-if="state === 'thinking'" class="m-dots">
        <rect x="88" y="0" width="32" height="18" rx="9" fill="#fff" :stroke="INK" stroke-width="3" />
        <circle class="d1" cx="97" cy="9" r="2.6" :fill="INK" />
        <circle class="d2" cx="104" cy="9" r="2.6" :fill="INK" />
        <circle class="d3" cx="111" cy="9" r="2.6" :fill="INK" />
      </g>
      <g v-if="state === 'decorating'" class="m-brush">
        <rect x="98" y="58" width="8" height="34" rx="3" fill="#A86B3C" :stroke="INK" stroke-width="3" transform="rotate(25 102 75)" />
        <rect x="102" y="40" width="14" height="18" rx="4" fill="#FF7AD9" :stroke="INK" stroke-width="3" transform="rotate(25 102 75)" />
      </g>
      <g v-if="state === 'success'" class="m-sparkles">
        <path class="s1" d="M8 20 L10 26 L16 28 L10 30 L8 36 L6 30 L0 28 L6 26 Z" fill="#FFD84D" :stroke="INK" stroke-width="2" />
        <path class="s2" d="M106 4 L108 9 L113 11 L108 13 L106 18 L104 13 L99 11 L104 9 Z" fill="#7DFF8A" :stroke="INK" stroke-width="2" />
        <circle class="s3" cx="112" cy="34" r="3" fill="#FF7AD9" :stroke="INK" stroke-width="2" />
      </g>
      <g v-if="state === 'paused'" class="m-zzz" :fill="INK" font-family="Arial Black, Arial, sans-serif" font-weight="900">
        <text class="z1" x="96" y="26" font-size="14">z</text>
        <text class="z2" x="106" y="14" font-size="10">z</text>
      </g>
      <g v-if="state === 'warning'">
        <path class="m-sweat" d="M100 34 Q106 44 100 48 Q94 44 100 34 Z" fill="#59A7FF" :stroke="INK" stroke-width="2.5" />
        <rect x="94" y="0" width="20" height="22" rx="6" fill="#FF6B57" :stroke="INK" stroke-width="3" />
        <rect x="102.5" y="4" width="3.5" height="9" rx="1.5" fill="#111" />
        <circle cx="104.2" cy="17" r="2" fill="#111" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.ps-mascot {
  display: block;
  overflow: visible;
}
.m-float {
  transform-origin: 60px 100px;
  animation: m-bob 2.6s ease-in-out infinite;
}
.is-decorating .m-float {
  animation: m-wiggle 0.5s ease-in-out infinite;
}
.is-success .m-float {
  animation: m-jump 0.6s cubic-bezier(0.3, 1.6, 0.6, 1) 2;
}
.is-paused .m-float {
  animation: m-bob 4s ease-in-out infinite;
}
.is-warning .m-float {
  animation: m-shake 0.4s ease-in-out 3;
}
.m-blink {
  transform-origin: 60px 57px;
  animation: m-blink 4.2s infinite;
}
.m-blink.look-up {
  transform: translate(3px, -4px);
  animation: none;
}
.is-thinking .m-bulb {
  animation: m-glow 0.9s ease-in-out infinite alternate;
  transform-origin: 60px 11px;
}
.m-antenna {
  transform-origin: 60px 30px;
  animation: m-sway 3s ease-in-out infinite;
}
.m-dots circle {
  animation: m-dot 1s ease-in-out infinite;
}
.m-dots .d2 { animation-delay: 0.15s; }
.m-dots .d3 { animation-delay: 0.3s; }
.m-brush {
  transform-origin: 100px 90px;
  animation: m-paint 0.5s ease-in-out infinite alternate;
}
.m-star-eye {
  transform-box: fill-box;
  transform-origin: center;
  animation: m-spin 1.6s linear infinite;
}
.m-sparkles path,
.m-sparkles circle {
  transform-box: fill-box;
  transform-origin: center;
  animation: m-twinkle 0.9s ease-in-out infinite alternate;
}
.m-sparkles .s2 { animation-delay: 0.3s; }
.m-sparkles .s3 { animation-delay: 0.6s; }
.m-zzz text {
  animation: m-zzz 2.4s ease-in-out infinite;
}
.m-zzz .z2 { animation-delay: 0.8s; }
.m-sweat {
  animation: m-drip 1.2s ease-in infinite;
}
.still *,
.still .m-float {
  animation: none !important;
}

@keyframes m-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes m-wiggle {
  0%, 100% { transform: rotate(-3deg); }
  50% { transform: rotate(3deg); }
}
@keyframes m-jump {
  0% { transform: translateY(0) scale(1, 1); }
  30% { transform: translateY(2px) scale(1.08, 0.92); }
  60% { transform: translateY(-12px) scale(0.95, 1.06); }
  100% { transform: translateY(0) scale(1, 1); }
}
@keyframes m-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  75% { transform: translateX(3px); }
}
@keyframes m-blink {
  0%, 92%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
@keyframes m-glow {
  from { transform: scale(1); }
  to { transform: scale(1.25); }
}
@keyframes m-sway {
  0%, 100% { transform: rotate(-6deg); }
  50% { transform: rotate(6deg); }
}
@keyframes m-dot {
  0%, 100% { transform: translateY(0); opacity: 0.4; }
  50% { transform: translateY(-2px); opacity: 1; }
}
@keyframes m-paint {
  from { transform: rotate(-12deg); }
  to { transform: rotate(10deg); }
}
@keyframes m-spin {
  from { transform: rotate(0); }
  to { transform: rotate(360deg); }
}
@keyframes m-twinkle {
  from { transform: scale(0.6); opacity: 0.5; }
  to { transform: scale(1.15); opacity: 1; }
}
@keyframes m-zzz {
  0% { transform: translate(0, 4px); opacity: 0; }
  40% { opacity: 1; }
  100% { transform: translate(4px, -6px); opacity: 0; }
}
@keyframes m-drip {
  0% { transform: translateY(-2px); opacity: 0; }
  30% { opacity: 1; }
  100% { transform: translateY(8px); opacity: 0; }
}
</style>
