<script setup lang="ts">
import type { Scope } from '../store';
const model = defineModel<Scope>({ required: true });
defineProps<{ path?: string }>();
</script>

<template>
  <div class="ps-scope">
    <span class="nb-label">应用到</span>
    <div class="ps-scope-btns">
      <button class="ps-scope-btn" :class="{ on: model === 'site' }" @click="model = 'site'">整个站点</button>
      <button class="ps-scope-btn" :class="{ on: model === 'page' }" :title="path" @click="model = 'page'">仅当前页面</button>
    </div>
  </div>
</template>

<style scoped>
.ps-scope {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ps-scope .nb-label {
  margin: 0;
}
.ps-scope-btns {
  display: inline-flex;
  border: 2.5px solid var(--ink);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 2px 2px 0 var(--ink);
}
.ps-scope-btn {
  appearance: none;
  border: none;
  padding: 4px 10px;
  font: 800 12px/1.4 var(--font);
  background: #fff;
  color: var(--ink);
  cursor: pointer;
}
.ps-scope-btn + .ps-scope-btn {
  border-left: 2.5px solid var(--ink);
}
.ps-scope-btn.on {
  background: var(--ink);
  color: var(--yellow);
}
</style>
