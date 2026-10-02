import type { AIConfig } from '../types';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function endpointOf(apiUrl: string) {
  const u = apiUrl.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/.test(u)) return u;
  return `${u}/chat/completions`;
}

/** OpenAI Compatible Chat Completions 调用（在 background 中执行） */
export async function chatCompletion(cfg: AIConfig, messages: ChatTurn[], overrides?: Partial<{ maxTokens: number }>) {
  if (!cfg.apiUrl) throw new Error('还没有配置 API URL，请先到设置页填写');
  if (!cfg.model) throw new Error('还没有配置模型名称');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.timeout || 60000);
  try {
    const res = await fetch(endpointOf(cfg.apiUrl), {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature,
        max_tokens: overrides?.maxTokens ?? cfg.maxTokens,
        stream: false,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = text.slice(0, 300);
      try {
        msg = JSON.parse(text)?.error?.message ?? msg;
      } catch {}
      throw new Error(`AI 服务返回 ${res.status}：${msg}`);
    }
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('AI 服务返回的不是 JSON，请检查 API URL 是否正确');
    }
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI 没有返回内容');
    return content;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`请求超时（${Math.round((cfg.timeout || 60000) / 1000)} 秒）`);
    if (e instanceof TypeError) throw new Error('连接失败：无法访问 AI 服务，请检查 URL 或网络');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
