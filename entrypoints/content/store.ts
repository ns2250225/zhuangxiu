import { defineStore } from 'pinia';
import { computed, markRaw, ref, shallowRef, triggerRef, watch } from 'vue';
import { browser } from 'wxt/browser';
import type {
  AIPlan,
  ChatMessage,
  DecorationCodePayload,
  DecorationRule,
  MascotState,
  SiteDecoration,
  Settings,
} from '@/lib/types';
import type { BgResponse, PanelTab } from '@/lib/messages';
import { DecorationEngine, countMatches } from '@/lib/decoration-engine';
import {
  DEFAULT_SETTINGS,
  aiConfigItem,
  getAIConfig,
  getChat,
  getDecorations,
  getSettings,
  mascotHiddenHostsItem,
  pausedHostsItem,
  setChat,
  setDecorations,
  setMascotHidden,
  settingsItem,
  togglePaused,
  watchDecorations,
} from '@/lib/storage';
import { clone, matchPath, throttle, uid } from '@/lib/utils';
import { type Preset, presetToRules } from '@/lib/presets';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/ai/prompt';
import { parsePlan } from '@/lib/ai/parse';
import { buildElementsSummary, buildPageSummary } from '@/lib/page-summary';
import { isOwnUi, similarSelector, uniqueSelector } from '@/lib/selector-engine';

export type Scope = 'site' | 'page';
export type PreviewKind = 'ai' | 'preset' | 'import' | 'manual' | 'edit';

export const engine = new DecorationEngine();

const SITE_PATTERN = '/*';
const pathNow = () => location.pathname || '/';

/* ---------------- 纯函数：在装修列表上做变换 ---------------- */

function sortDecos(list: SiteDecoration[]) {
  // 整站装修在前，页面装修在后（后者覆盖前者）
  return [...list].sort(
    (a, b) => Number(a.pathPattern !== SITE_PATTERN) - Number(b.pathPattern !== SITE_PATTERN) || a.createdAt - b.createdAt,
  );
}

export function matchingDecos(list: SiteDecoration[], path = pathNow()) {
  return sortDecos(list.filter((d) => matchPath(d.pathPattern, path)));
}

export function activeRulesOf(list: SiteDecoration[], path = pathNow()): DecorationRule[] {
  const out: DecorationRule[] = [];
  matchingDecos(list, path).forEach((d, di) => {
    if (!d.enabled) return;
    for (const r of d.rules) out.push({ ...r, priority: di * 10000 + r.priority });
  });
  return out;
}

function ensureDeco(list: SiteDecoration[], scope: Scope, host: string, name?: string): SiteDecoration {
  const pattern = scope === 'site' ? SITE_PATTERN : pathNow();
  let d = list.find((x) => x.pathPattern === pattern);
  if (!d) {
    d = {
      id: uid('deco'),
      name: name || (scope === 'site' ? '整站装修' : `页面装修 ${pattern}`),
      host,
      pathPattern: pattern,
      enabled: true,
      rules: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    list.push(d);
  }
  return d;
}

const nextPriority = (d: SiteDecoration) => d.rules.reduce((m, r) => Math.max(m, r.priority), -1) + 1;

function addRules(list: SiteDecoration[], rules: DecorationRule[], scope: Scope, host: string) {
  const next = clone(list);
  const d = ensureDeco(next, scope, host);
  let p = nextPriority(d);
  for (const r of rules) d.rules.push({ ...r, priority: p++ });
  d.enabled = true;
  d.updatedAt = Date.now();
  return next;
}

function applyPlan(list: SiteDecoration[], plan: AIPlan, scope: Scope, host: string) {
  const next = clone(list);
  const remove = new Set(plan.removeIds);
  const fresh: DecorationRule[] = [];
  for (const r of plan.rules) {
    const owner = r.id ? next.find((d) => d.rules.some((x) => x.id === r.id)) : undefined;
    if (owner) {
      const target = owner.rules.find((x) => x.id === r.id)!;
      target.selector = r.selector;
      target.styles = { ...r.styles };
      if (r.note) target.note = r.note;
      target.enabled = true;
      owner.updatedAt = Date.now();
    } else {
      fresh.push({ id: uid('ai'), selector: r.selector, styles: { ...r.styles }, enabled: true, source: 'ai', priority: 0, note: r.note });
    }
  }
  for (const d of next) d.rules = d.rules.filter((x) => !remove.has(x.id));
  const withNew = fresh.length ? addRules(next, fresh, scope, host) : next;
  return withNew.filter((d) => d.rules.length > 0);
}

function applyPreset(list: SiteDecoration[], preset: Preset, scope: Scope, host: string) {
  const next = clone(list);
  const d = ensureDeco(next, scope, host);
  // 同一范围只保留一个预设主题；预设放在最前，AI/手动规则可以覆盖它
  d.rules = d.rules.filter((r) => r.source !== 'preset');
  const base = d.rules.reduce((m, r) => Math.min(m, r.priority), 0) - preset.rules.length - 1;
  d.rules.unshift(...presetToRules(preset, base));
  d.enabled = true;
  d.updatedAt = Date.now();
  return next;
}

/** AI 多轮修改：把新返回的 patch 合并进当前预览中的方案 */
function mergePlan(base: AIPlan, patch: AIPlan): AIPlan {
  const rules = [...base.rules];
  const remove = new Set(base.removeIds);
  for (const r of patch.rules) {
    const i = r.id ? rules.findIndex((x) => x.id === r.id) : -1;
    if (i >= 0) rules[i] = { ...rules[i], ...r };
    else rules.push(r);
  }
  for (const id of patch.removeIds) {
    const i = rules.findIndex((x) => x.id === id);
    if (i >= 0) rules.splice(i, 1);
    else remove.add(id);
  }
  return {
    name: patch.name || base.name,
    explanation: patch.explanation,
    rules,
    removeIds: [...remove],
    dropped: patch.dropped,
  };
}

/** 给方案里的新规则编号，方便多轮对话中 AI 引用 */
function tagDraftIds(plan: AIPlan, savedIds: Set<string>): AIPlan {
  let n = 0;
  const used = new Set(plan.rules.map((r) => r.id).filter(Boolean));
  return {
    ...plan,
    rules: plan.rules.map((r) => {
      if (r.id && (savedIds.has(r.id) || r.id.startsWith('draft_'))) return r;
      let id: string;
      do id = `draft_${++n}`;
      while (used.has(id));
      used.add(id);
      return { ...r, id };
    }),
  };
}

/* ---------------- Store ---------------- */

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'info';
}

export const useStudio = defineStore('studio', () => {
  const host = location.hostname;
  const path = ref(pathNow());
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS });
  const aiReady = ref(false);
  const decorations = ref<SiteDecoration[]>([]);
  const paused = ref(false);
  const mascotHidden = ref(false);

  const panelOpen = ref(false);
  const panelTab = ref<PanelTab>('ai');
  const panelCollapsed = ref(false);

  const preview = ref<{ kind: PreviewKind; label: string; next: SiteDecoration[] } | null>(null);
  const hits = ref<Record<string, number>>({});

  /* ---------- 撤销 / 重做 ---------- */
  const past = ref<SiteDecoration[][]>([]);
  const future = ref<SiteDecoration[][]>([]);

  /* ---------- 元素选择 ---------- */
  const picking = ref(false);
  const hovered = shallowRef<Element | null>(null);
  const selected = shallowRef<Element[]>([]);
  const useSimilar = ref(false);
  const customSelector = ref('');
  /** 正在为哪条失效规则重新选择元素 */
  const reselectFor = ref<string | null>(null);

  /* ---------- AI ---------- */
  const chat = ref<ChatMessage[]>([]);
  const aiBusy = ref(false);
  const draftPlan = ref<AIPlan | null>(null);
  const draftScope = ref<Scope>('site');
  const draftMsgIndex = ref(-1);

  /* ---------- 吉祥物 / 提示 ---------- */
  const flash = ref<MascotState | null>(null);
  const toasts = ref<Toast[]>([]);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  const pageDecos = computed(() => matchingDecos(decorations.value, path.value));
  const savedRules = computed(() => activeRulesOf(decorations.value, path.value));
  const effectiveRules = computed<DecorationRule[] | null>(() => {
    if (preview.value) return activeRulesOf(preview.value.next, path.value);
    if (paused.value) return null;
    return savedRules.value;
  });
  const ruleCount = computed(() => pageDecos.value.reduce((n, d) => n + d.rules.length, 0));
  const decorated = computed(() => savedRules.value.some((r) => r.enabled));
  /** 失效规则：非预设、已启用却在页面上找不到目标 */
  const brokenRules = computed(() =>
    savedRules.value.filter((r) => r.enabled && r.source !== 'preset' && hits.value[r.id] === 0),
  );

  const similar = computed(() => (selected.value.length === 1 ? similarSelector(selected.value[0]!) : null));
  const selectionSelector = computed(() => {
    if (customSelector.value.trim()) return customSelector.value.trim();
    if (useSimilar.value && similar.value) return similar.value.selector;
    return selected.value.map((el) => uniqueSelector(el)).join(', ');
  });

  const mascotState = computed<MascotState>(() => {
    if (aiBusy.value) return 'thinking';
    if (flash.value) return flash.value;
    if (preview.value || picking.value) return 'decorating';
    if (paused.value && decorated.value) return 'paused';
    if (brokenRules.value.length) return 'warning';
    return 'idle';
  });

  const statusText = computed(() => {
    switch (mascotState.value) {
      case 'thinking':
        return '正在构思装修方案…';
      case 'decorating':
        return picking.value ? '选择要装修的元素' : '预览中，记得决定是否采用';
      case 'success':
        return '装修成功！';
      case 'paused':
        return '装修已暂停（显示原样）';
      case 'warning':
        return `${brokenRules.value.length} 条规则未命中`;
      default:
        return decorated.value ? `已装修 · ${savedRules.value.length} 条规则` : '点我装修这个网页';
    }
  });

  /* ---------- 渲染 & 命中统计 ---------- */
  const recountHits = () => {
    const out: Record<string, number> = {};
    const rules = preview.value ? activeRulesOf(preview.value.next, path.value) : savedRules.value;
    for (const r of rules) out[r.id] = r.action === 'remove' ? engine.countFor(r) : countMatches(r.selector);
    hits.value = out;
  };
  const recountLater = throttle(recountHits, 1500);

  watch(effectiveRules, (rules) => {
    engine.render(rules);
    recountLater();
  });

  function toast(text: string, kind: Toast['kind'] = 'info') {
    const t = { id: Date.now() + Math.random(), text, kind };
    toasts.value = [...toasts.value.slice(-2), t];
    setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), kind === 'err' ? 5000 : 2600);
  }
  function flashMascot(s: MascotState, ms = 2600) {
    flash.value = s;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash.value = null), ms);
  }

  /* ---------- 持久化 ---------- */
  let lastWritten = '';
  async function persist(list: SiteDecoration[]) {
    const clean = clone(list.filter((d) => d.rules.length > 0));
    decorations.value = clean;
    lastWritten = JSON.stringify(clean);
    await setDecorations(host, clean);
  }

  async function commit(next: SiteDecoration[], msg?: string) {
    past.value.push(clone(decorations.value));
    if (past.value.length > 50) past.value.shift();
    future.value = [];
    preview.value = null;
    await persist(next);
    if (msg) toast(msg, 'ok');
  }

  async function undo() {
    const prev = past.value.pop();
    if (!prev) return toast('没有可以撤销的操作');
    future.value.push(clone(decorations.value));
    preview.value = null;
    await persist(prev);
    toast('已撤销');
  }
  async function redo() {
    const nxt = future.value.pop();
    if (!nxt) return toast('没有可以重做的操作');
    past.value.push(clone(decorations.value));
    preview.value = null;
    await persist(nxt);
    toast('已重做');
  }

  /* ---------- 预览 ---------- */
  function setPreview(kind: PreviewKind, label: string, next: SiteDecoration[]) {
    preview.value = { kind, label, next };
  }
  function resetDraft() {
    draftPlan.value = null;
    draftMsgIndex.value = -1;
  }
  function cancelPreview() {
    if (preview.value?.kind === 'ai') resetDraft();
    preview.value = null;
  }
  async function adoptPreview(msg = '已采用装修方案 ✨') {
    if (!preview.value) return;
    if (preview.value.kind === 'ai') resetDraft();
    await commit(preview.value.next, msg);
    if (paused.value) await setPaused(false);
    flashMascot('success');
  }

  /* ---------- 原样 / 恢复 ---------- */
  async function setPaused(v: boolean) {
    paused.value = v;
    await togglePaused(host, v);
  }
  async function toggleOriginal() {
    if (preview.value) cancelPreview();
    const now = !paused.value;
    await setPaused(now);
    toast(now ? '已显示原样（规则保留）' : '已恢复装修效果', 'info');
  }

  /* ---------- 规则操作 ---------- */
  function mutate(fn: (list: SiteDecoration[]) => void) {
    const next = clone(decorations.value);
    fn(next);
    return next;
  }
  const toggleRule = (id: string, enabled: boolean) =>
    commit(mutate((l) => l.forEach((d) => d.rules.forEach((r) => r.id === id && (r.enabled = enabled)))));
  const deleteRule = (id: string) =>
    commit(mutate((l) => l.forEach((d) => (d.rules = d.rules.filter((r) => r.id !== id)))), '规则已删除');
  const updateRule = (id: string, patch: Partial<DecorationRule>) =>
    commit(
      mutate((l) =>
        l.forEach((d) =>
          d.rules.forEach((r) => {
            if (r.id === id) Object.assign(r, patch, { styles: patch.styles ? { ...patch.styles } : r.styles });
          }),
        ),
      ),
      '规则已更新',
    );
  const previewRuleEdit = (id: string, patch: Partial<DecorationRule>) =>
    setPreview(
      'edit',
      '编辑规则',
      mutate((l) => l.forEach((d) => d.rules.forEach((r) => r.id === id && Object.assign(r, patch)))),
    );
  const toggleDeco = (id: string, enabled: boolean) =>
    commit(mutate((l) => l.forEach((d) => d.id === id && (d.enabled = enabled))));
  const renameDeco = (id: string, name: string) =>
    commit(mutate((l) => l.forEach((d) => d.id === id && (d.name = name.slice(0, 60)))));
  const deleteDeco = (id: string) => commit(decorations.value.filter((d) => d.id !== id), '已删除该装修');
  const setAllEnabled = (v: boolean) =>
    commit(
      mutate((l) =>
        l.forEach((d) => {
          if (!matchPath(d.pathPattern, path.value)) return;
          d.enabled = v;
          d.rules.forEach((r) => (r.enabled = v));
        }),
      ),
      v ? '已全部启用' : '已全部关闭',
    );
  const deletePageDecos = () =>
    commit(
      decorations.value.filter((d) => d.pathPattern === SITE_PATTERN || !matchPath(d.pathPattern, path.value)),
      '已删除当前页面装修',
    );
  const deleteSiteDecos = () => commit([], '已删除整个站点的装修');

  function addRulesNow(rules: DecorationRule[], scope: Scope, msg = '装修已保存') {
    return commit(addRules(decorations.value, rules, scope, host), msg).then(() => flashMascot('success'));
  }
  function previewAddRules(rules: DecorationRule[], scope: Scope, kind: PreviewKind, label: string) {
    setPreview(kind, label, addRules(decorations.value, rules, scope, host));
  }

  /* ---------- 预设 ---------- */
  function previewPreset(p: Preset, scope: Scope) {
    setPreview('preset', `预设：${p.name}`, applyPreset(decorations.value, p, scope, host));
  }
  function removePresets() {
    return commit(
      mutate((l) => l.forEach((d) => (d.rules = d.rules.filter((r) => r.source !== 'preset')))),
      '已移除预设主题',
    );
  }
  const activePresetIds = computed(
    () => new Set(savedRules.value.filter((r) => r.source === 'preset' && r.presetId).map((r) => r.presetId!)),
  );

  /* ---------- 装修码导入 ---------- */
  function importToList(payload: DecorationCodePayload) {
    const next = clone(decorations.value);
    const sameHost = payload.host === host;
    const pattern = sameHost ? payload.pathPattern || SITE_PATTERN : SITE_PATTERN;
    next.push({
      id: uid('deco'),
      name: payload.name || '导入的装修',
      host,
      pathPattern: pattern,
      enabled: true,
      rules: payload.rules.map((r, i) => ({ ...r, id: uid('imp'), source: 'import', enabled: true, priority: i })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return next;
  }
  function previewImport(payload: DecorationCodePayload) {
    setPreview('import', `导入：${payload.name}`, importToList(payload));
    recountHits();
  }

  /* ---------- 元素选择 ---------- */
  function startPicker() {
    picking.value = true;
    panelOpen.value = true;
    panelTab.value = 'picker';
    panelCollapsed.value = true;
  }
  function stopPicker() {
    picking.value = false;
    hovered.value = null;
    panelCollapsed.value = false;
  }
  function setSelection(els: Element[]) {
    selected.value = markRaw(els.filter((e) => !isOwnUi(e)));
    useSimilar.value = false;
    customSelector.value = '';
  }
  function pick(el: Element, mode: 'replace' | 'toggle' | 'remove') {
    const cur = selected.value;
    if (mode === 'replace') setSelection([el]);
    else if (mode === 'remove') setSelection(cur.filter((e) => e !== el));
    else setSelection(cur.includes(el) ? cur.filter((e) => e !== el) : [...cur, el]);
  }
  function walkSelection(dir: 'parent' | 'child') {
    const cur = selected.value;
    const base = cur.length ? cur[cur.length - 1] : hovered.value;
    if (!base) return;
    const next =
      dir === 'parent'
        ? base.parentElement && !['html'].includes(base.parentElement.tagName.toLowerCase())
          ? base.parentElement
          : null
        : base.firstElementChild;
    if (!next) return toast(dir === 'parent' ? '已经是最外层了' : '没有子元素了');
    setSelection(cur.length ? [...cur.slice(0, -1), next] : [next]);
  }
  const clearSelection = () => setSelection([]);
  function refreshSelection() {
    triggerRef(selected);
  }

  /* ---------- AI ---------- */
  async function saveChat() {
    if (settings.value.saveChat) await setChat(host, chat.value);
  }

  function buildAIContext(request: string, opts: { repair?: boolean } = {}) {
    const els = selected.value;
    const includeText = settings.value.includeText;
    const pageSummary = buildPageSummary({ includeText, maxNodes: els.length ? 80 : 160 });
    const elementsSummary = els.length
      ? buildElementsSummary(els, includeText) + (useSimilar.value && similar.value ? `\n(用户希望应用到全部相似元素：${similar.value.selector}，共 ${similar.value.count} 个)` : '')
      : customSelector.value
        ? `选择器：${customSelector.value}`
        : undefined;
    const previous = chat.value
      .filter((m) => m.role === 'user')
      .slice(-4)
      .map((m) => '- ' + m.content)
      .join('\n');
    const userPrompt = buildUserPrompt({
      request: (previous && draftPlan.value ? `之前的需求：\n${previous}\n\n本次：` : '') + request,
      pageSummary,
      elementsSummary,
      savedRules: savedRules.value,
      draftRules: draftPlan.value?.rules,
      brokenRules: opts.repair ? brokenRules.value : undefined,
    });
    return {
      userPrompt,
      meta: {
        pageLines: pageSummary.split('\n').length,
        elements: els.length,
        savedRules: savedRules.value.length,
        draftRules: draftPlan.value?.rules.length ?? 0,
        includeText,
      },
    };
  }

  async function sendAI(request: string, opts: { repair?: boolean; userPrompt?: string } = {}) {
    if (aiBusy.value) return;
    request = request.trim();
    if (!request) return;
    const cfg = await getAIConfig();
    if (!cfg.apiUrl || !cfg.model) {
      toast('还没有配置 AI 模型，先去设置页填写 URL / Key / Model 吧', 'err');
      return;
    }
    const userPrompt = opts.userPrompt ?? buildAIContext(request, opts).userPrompt;
    chat.value.push({ role: 'user', content: request, at: Date.now() });
    aiBusy.value = true;
    try {
      const res = (await browser.runtime.sendMessage({
        type: 'ai:chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      })) as BgResponse;
      if (!res?.ok) throw new Error(res?.error || 'AI 请求失败');
      const savedIds = new Set(savedRules.value.map((r) => r.id));
      let plan = parsePlan(res.content);
      if (!plan.rules.length && !plan.removeIds.length) throw new Error('AI 没有给出可用的装修规则，换个描述试试？');
      if (draftPlan.value && !opts.repair) plan = mergePlan(draftPlan.value, plan);
      plan = tagDraftIds(plan, savedIds);
      chat.value.push({ role: 'assistant', content: plan.name, plan, at: Date.now() });
      draftMsgIndex.value = chat.value.length - 1;
      previewPlan(plan, draftScope.value);
    } catch (e: any) {
      chat.value.push({
        role: 'assistant',
        content: `${e?.message ?? e}\n（AI 不可用时，仍然可以使用「预设」和「手动装修」）`,
        error: true,
        at: Date.now(),
      });
      flashMascot('warning', 2000);
    } finally {
      aiBusy.value = false;
      saveChat();
    }
  }

  function previewPlan(plan: AIPlan, scope: Scope) {
    draftPlan.value = plan;
    draftScope.value = scope;
    setPreview('ai', `AI：${plan.name}`, applyPlan(decorations.value, plan, scope, host));
  }

  async function adoptPlan(plan: AIPlan, scope: Scope) {
    resetDraft();
    await commit(applyPlan(decorations.value, plan, scope, host), `已采用「${plan.name}」✨`);
    if (paused.value) await setPaused(false);
    flashMascot('success');
  }

  function discardDraft() {
    resetDraft();
    if (preview.value?.kind === 'ai') preview.value = null;
  }

  async function clearChat() {
    chat.value = [];
    discardDraft();
    await setChat(host, []);
  }

  /* ---------- 吉祥物 ---------- */
  async function hideMascot() {
    mascotHidden.value = true;
    await setMascotHidden(host, true);
    toast('吉祥物已在本站隐藏，可在工具栏弹窗里重新显示');
  }

  function status() {
    return {
      host,
      supported: true,
      decorated: decorated.value,
      paused: paused.value,
      ruleCount: savedRules.value.length,
      missCount: brokenRules.value.length,
      decorationNames: pageDecos.value.map((d) => d.name),
    };
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    const [list, s, ph, mh] = await Promise.all([
      getDecorations(host),
      getSettings(),
      pausedHostsItem.getValue(),
      mascotHiddenHostsItem.getValue(),
    ]);
    decorations.value = list;
    settings.value = s;
    paused.value = ph.includes(host);
    mascotHidden.value = mh.includes(host);
    engine.render(effectiveRules.value);
    const cfg = await getAIConfig();
    aiReady.value = !!(cfg.apiUrl && cfg.model);
    if (s.saveChat) chat.value = await getChat(host);

    // 跨标签页同步
    watchDecorations(host, (v) => {
      if (JSON.stringify(v) === lastWritten) return;
      decorations.value = v;
    });
    settingsItem.watch((v) => (settings.value = { ...DEFAULT_SETTINGS, ...v }));
    pausedHostsItem.watch((v) => (paused.value = (v ?? []).includes(host)));
    mascotHiddenHostsItem.watch((v) => (mascotHidden.value = (v ?? []).includes(host)));
    aiConfigItem.watch((v) => (aiReady.value = !!(v?.apiUrl && v?.model)));
  }

  function onLocationChange(nextPath = pathNow()) {
    if (nextPath === path.value) return;
    path.value = nextPath;
    if (preview.value) cancelPreview();
    recountLater();
  }

  return {
    host,
    path,
    settings,
    aiReady,
    decorations,
    paused,
    mascotHidden,
    panelOpen,
    panelTab,
    panelCollapsed,
    preview,
    hits,
    past,
    future,
    picking,
    hovered,
    selected,
    useSimilar,
    customSelector,
    reselectFor,
    chat,
    aiBusy,
    draftPlan,
    draftScope,
    draftMsgIndex,
    toasts,
    pageDecos,
    savedRules,
    ruleCount,
    decorated,
    brokenRules,
    similar,
    selectionSelector,
    mascotState,
    statusText,
    activePresetIds,
    init,
    onLocationChange,
    recountHits,
    recountLater,
    toast,
    flashMascot,
    commit,
    undo,
    redo,
    setPreview,
    cancelPreview,
    adoptPreview,
    toggleOriginal,
    setPaused,
    toggleRule,
    deleteRule,
    updateRule,
    previewRuleEdit,
    toggleDeco,
    renameDeco,
    deleteDeco,
    setAllEnabled,
    deletePageDecos,
    deleteSiteDecos,
    addRulesNow,
    previewAddRules,
    previewPreset,
    removePresets,
    previewImport,
    importToList,
    startPicker,
    stopPicker,
    pick,
    setSelection,
    walkSelection,
    clearSelection,
    refreshSelection,
    buildAIContext,
    sendAI,
    previewPlan,
    adoptPlan,
    discardDraft,
    clearChat,
    hideMascot,
    status,
  };
});
