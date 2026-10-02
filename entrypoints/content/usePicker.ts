import { onBeforeUnmount, ref, watch } from 'vue';
import { useStudio } from './store';
import { isOwnUi } from '@/lib/selector-engine';

export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const rectOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

/** 元素选择模式：基于 elementFromPoint 的悬停高亮 + 捕获阶段拦截点击 */
export function usePicker() {
  const s = useStudio();
  const hoverBox = ref<Box | null>(null);
  const selBoxes = ref<Box[]>([]);
  let raf = 0;
  let mouse = { x: -1, y: -1 };

  const loop = () => {
    raf = 0;
    if (s.picking && mouse.x >= 0) {
      const el = document.elementFromPoint(mouse.x, mouse.y);
      if (el && !isOwnUi(el) && el !== document.documentElement) {
        if (el !== s.hovered) s.hovered = el;
      } else if (el && isOwnUi(el)) s.hovered = null;
    }
    hoverBox.value = s.picking && s.hovered ? rectOf(s.hovered) : null;
    selBoxes.value = s.panelOpen ? s.selected.filter((e) => e.isConnected).map(rectOf) : [];
    if (s.picking || s.selected.length) raf = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  const onMove = (e: MouseEvent) => {
    mouse = { x: e.clientX, y: e.clientY };
    kick();
  };
  const block = (e: Event) => {
    if (!s.picking) return;
    const t = e.composedPath()[0] as Element | undefined;
    if (t && isOwnUi(t as Element)) return;
    // 在 Shadow DOM 中的 composedPath 第一个元素可能是内部节点
    if ((e.target as Element | null) && isOwnUi(e.target as Element)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  };
  const onClick = (e: MouseEvent) => {
    if (!s.picking) return;
    if (isOwnUi(e.target as Element)) return;
    block(e);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || isOwnUi(el)) return;
    s.pick(el, e.altKey ? 'remove' : e.shiftKey || e.metaKey || e.ctrlKey ? 'toggle' : 'replace');
    kick();
  };
  const onKey = (e: KeyboardEvent) => {
    if (!s.picking) return;
    if (e.key === 'Escape') {
      s.stopPicker();
    } else if (e.key === 'ArrowUp' || e.key === '[') {
      s.walkSelection('parent');
    } else if (e.key === 'ArrowDown' || e.key === ']') {
      s.walkSelection('child');
    } else if (e.key === 'Enter') {
      s.stopPicker();
    } else return;
    e.preventDefault();
    e.stopPropagation();
    kick();
  };

  const events = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu', 'submit'] as const;
  const on = () => {
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    events.forEach((ev) => window.addEventListener(ev, block, true));
    document.documentElement.style.setProperty('cursor', 'crosshair', 'important');
    kick();
  };
  const off = () => {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    events.forEach((ev) => window.removeEventListener(ev, block, true));
    document.documentElement.style.removeProperty('cursor');
  };

  watch(
    () => s.picking,
    (v) => (v ? on() : off()),
    { immediate: true },
  );
  watch([() => s.selected, () => s.panelOpen], () => kick());
  window.addEventListener('scroll', kick, true);
  window.addEventListener('resize', kick);

  onBeforeUnmount(() => {
    off();
    cancelAnimationFrame(raf);
    window.removeEventListener('scroll', kick, true);
    window.removeEventListener('resize', kick);
  });

  return { hoverBox, selBoxes };
}
