import type { DecorationCodePayload, DecorationRule } from './types';
import { CodePayloadSchema } from './schema';
import { sanitizeSelector, sanitizeStyles } from './css-sanitize';
import { uid } from './utils';

export const CODE_PREFIX = 'PSAI1.';
const CODE_VERSION = 1;

function toB64Url(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s: string) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

/** 生成装修码：仅包含规则与适用范围，绝不包含 API 配置 / 聊天 / 隐私数据 */
export async function encodeShareCode(input: {
  name: string;
  host: string;
  pathPattern: string;
  rules: DecorationRule[];
}): Promise<string> {
  const payload: DecorationCodePayload = {
    version: CODE_VERSION,
    name: input.name.slice(0, 100),
    host: input.host,
    pathPattern: input.pathPattern,
    createdAt: Date.now(),
    rules: input.rules
      .filter((r) => r.enabled)
      .map((r) => ({
        id: r.id,
        selector: r.selector,
        styles: r.styles,
        enabled: true,
        source: r.source,
        priority: r.priority,
        ...(r.action === 'remove' ? { action: r.action } : {}),
        ...(r.note ? { note: r.note } : {}),
      })),
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return CODE_PREFIX + toB64Url(packed);
}

export interface DecodedCode {
  payload: DecorationCodePayload;
  dropped: string[];
}

export async function decodeShareCode(raw: string): Promise<DecodedCode> {
  let code = raw.trim().replace(/\s+/g, '');
  // 允许用户粘贴“带说明文字”的分享内容
  const idx = code.indexOf(CODE_PREFIX);
  if (idx < 0) throw new Error('这不是有效的装修码（需要以 PSAI1. 开头）');
  code = code.slice(idx + CODE_PREFIX.length).match(/^[A-Za-z0-9_-]+/)?.[0] ?? '';
  let data: unknown;
  try {
    const bytes = await pipe(fromB64Url(code), new DecompressionStream('deflate-raw'));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('装修码已损坏或复制不完整');
  }
  const parsed = CodePayloadSchema.safeParse(data);
  if (!parsed.success) throw new Error('装修码格式不正确');
  if (parsed.data.version > CODE_VERSION) throw new Error('装修码版本过新，请升级插件');

  const dropped: string[] = [];
  const rules: DecorationRule[] = [];
  parsed.data.rules.forEach((r, i) => {
    const selector = sanitizeSelector(r.selector);
    if (!selector) {
      dropped.push(`选择器不安全：${r.selector.slice(0, 60)}`);
      return;
    }
    const s = sanitizeStyles(r.styles);
    dropped.push(...s.dropped);
    const isRemove = r.action === 'remove';
    if (!Object.keys(s.styles).length && !isRemove) return;
    rules.push({
      id: uid('imp'),
      selector,
      styles: s.styles,
      enabled: true,
      source: 'import',
      priority: r.priority ?? i,
      ...(isRemove ? { action: 'remove' as const } : {}),
      ...(r.note ? { note: r.note } : {}),
    });
  });
  return { payload: { ...parsed.data, rules }, dropped };
}
