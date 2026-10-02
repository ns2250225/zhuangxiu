<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useStudio } from '../store';
import { decodeShareCode, encodeShareCode, type DecodedCode } from '@/lib/share-code';
import { activeRulesOf } from '../store';
import { formatTime } from '@/lib/utils';

const s = useStudio();

/* ---------- 生成 ---------- */
const name = ref(s.pageDecos[0]?.name ?? `${s.host} 装修`);
const range = ref<'all' | string>('all');
const code = ref('');
const copied = ref(false);

const sourceRules = computed(() => {
  if (range.value === 'all') return s.savedRules.filter((r) => r.enabled);
  const d = s.pageDecos.find((x) => x.id === range.value);
  return d ? d.rules.filter((r) => r.enabled) : [];
});
const pathPattern = computed(() => {
  if (range.value === 'all') return s.pageDecos.every((d) => d.pathPattern === '/*') ? '/*' : s.path;
  return s.pageDecos.find((x) => x.id === range.value)?.pathPattern ?? '/*';
});
watch([range, name], () => (code.value = ''));

async function generate() {
  if (!sourceRules.value.length) return s.toast('当前没有可分享的规则', 'err');
  code.value = await encodeShareCode({
    name: name.value.trim() || '我的装修',
    host: s.host,
    pathPattern: pathPattern.value,
    rules: sourceRules.value,
  });
  copy();
}
async function copy() {
  try {
    await navigator.clipboard.writeText(code.value);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1600);
    s.toast('装修码已复制，发给朋友吧 📮', 'ok');
  } catch {
    s.toast('复制失败，请手动选中复制', 'err');
  }
}

/* ---------- 导入 ---------- */
const input = ref('');
const decoded = ref<DecodedCode | null>(null);
const error = ref('');
const previewing = computed(() => s.preview?.kind === 'import');

async function parse() {
  error.value = '';
  decoded.value = null;
  try {
    decoded.value = await decodeShareCode(input.value);
    if (!decoded.value.payload.rules.length) error.value = '装修码里没有可用的规则';
  } catch (e: any) {
    error.value = e?.message ?? String(e);
  }
}
function doPreview() {
  if (decoded.value) s.previewImport(decoded.value.payload);
}
const hostMismatch = computed(() => !!decoded.value && decoded.value.payload.host !== s.host);
const matchStat = computed(() => {
  if (!decoded.value || !previewing.value) return null;
  const ids = new Set(activeRulesOf(s.preview!.next).map((r) => r.id));
  const imported = s.preview!.next[s.preview!.next.length - 1]?.rules.filter((r) => ids.has(r.id)) ?? [];
  const total = imported.length;
  const hit = imported.filter((r) => (s.hits[r.id] ?? 0) > 0).length;
  return { total, hit };
});
async function adopt() {
  if (!decoded.value) return;
  if (!previewing.value) s.previewImport(decoded.value.payload);
  await s.adoptPreview(`已复刻「${decoded.value.payload.name}」🎉`);
  decoded.value = null;
  input.value = '';
}
function cancelImport() {
  if (previewing.value) s.cancelPreview();
  decoded.value = null;
}
</script>

<template>
  <div class="cd">
    <div class="nb-card pink">
      <div class="nb-card-title">📮 分享装修码</div>
      <div class="nb-field">
        <span class="nb-label">方案名称</span>
        <input v-model="name" class="nb-input sm" maxlength="60" />
      </div>
      <div class="nb-field">
        <span class="nb-label">分享范围</span>
        <select v-model="range" class="nb-select sm">
          <option value="all">当前页面全部生效规则（{{ s.savedRules.filter((r) => r.enabled).length }} 条）</option>
          <option v-for="d in s.pageDecos" :key="d.id" :value="d.id">{{ d.name }}（{{ d.rules.length }} 条）</option>
        </select>
      </div>
      <div class="cd-scope">适用范围：<b>{{ s.host }}</b> · <b>{{ pathPattern === '/*' ? '整站' : pathPattern }}</b></div>
      <button class="nb-btn yellow block" :disabled="!sourceRules.length" @click="generate">生成并复制装修码</button>
      <template v-if="code">
        <div class="nb-code cd-code">{{ code }}</div>
        <button class="nb-btn sm" @click="copy">{{ copied ? '✔ 已复制' : '复制' }}</button>
      </template>
      <p class="cd-privacy">🔒 装修码只包含样式规则与适用网站，不包含 API 配置 / Key、聊天记录、账号或任何隐私数据。</p>
    </div>

    <div class="nb-card blue">
      <div class="nb-card-title">📥 导入装修码</div>
      <textarea v-model="input" class="nb-textarea mono" rows="3" placeholder="粘贴以 PSAI1. 开头的装修码"></textarea>
      <button class="nb-btn sm" style="margin-top: 8px" :disabled="!input.trim()" @click="parse">解析</button>
      <div v-if="error" class="cd-err">{{ error }}</div>

      <div v-if="decoded && decoded.payload.rules.length" class="cd-sum nb-pop">
        <div class="cd-sum-name">🎁 {{ decoded.payload.name }}</div>
        <div class="cd-sum-row">来源网站：<b>{{ decoded.payload.host || '未知' }}</b> · 范围 {{ decoded.payload.pathPattern === '/*' ? '整站' : decoded.payload.pathPattern }}</div>
        <div class="cd-sum-row">规则：<b>{{ decoded.payload.rules.length }}</b> 条 · 创建于 {{ formatTime(decoded.payload.createdAt) }}</div>
        <div v-if="decoded.dropped.length" class="cd-tag yellow">🛡 已拦截 {{ decoded.dropped.length }} 项不安全内容</div>
        <div v-if="hostMismatch" class="cd-tag red">⚠ 域名不一致（{{ decoded.payload.host }} → {{ s.host }}），效果可能不完整，将作为整站装修导入</div>

        <template v-if="matchStat">
          <div v-if="matchStat.hit === matchStat.total" class="cd-tag green">✔ 完全匹配：{{ matchStat.total }} 条规则全部命中</div>
          <div v-else class="cd-tag yellow">◐ 部分规则未命中：{{ matchStat.hit }} / {{ matchStat.total }} 命中</div>
        </template>

        <div class="nb-row wrap" style="margin-top: 10px">
          <button v-if="!previewing" class="nb-btn sm yellow" @click="doPreview">👀 预览效果</button>
          <button class="nb-btn sm green" @click="adopt">✨ 一键复刻</button>
          <button class="nb-btn sm" @click="cancelImport">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cd {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cd-scope {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 10px;
}
.cd-code {
  margin: 10px 0 8px;
  max-height: 120px;
  overflow: auto;
}
.cd-privacy {
  margin-top: 10px !important;
  font-size: 11.5px;
  font-weight: 700;
}
.cd-err {
  margin-top: 8px;
  padding: 6px 8px;
  font-weight: 800;
  font-size: 12px;
  background: var(--red);
  border: 2px solid var(--ink);
  border-radius: 6px;
}
.cd-sum {
  margin-top: 10px;
  padding: 10px;
  background: #fff;
  border: 2.5px solid var(--ink);
  border-radius: 8px;
}
.cd-sum-name {
  font-weight: 900;
  font-size: 15px;
  margin-bottom: 4px;
}
.cd-sum-row {
  font-size: 12px;
  font-weight: 600;
}
.cd-tag {
  margin-top: 6px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 800;
  border: 2px solid var(--ink);
  border-radius: 6px;
}
.cd-tag.yellow { background: var(--yellow); }
.cd-tag.red { background: var(--red); }
.cd-tag.green { background: var(--green); }
</style>
