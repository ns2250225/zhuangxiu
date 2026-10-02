export const uid = (prefix = 'r') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export const kebab = (prop: string) =>
  prop.startsWith('--') ? prop : prop.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()).replace(/^ms-/, '-ms-');

export const camel = (prop: string) =>
  prop.startsWith('--') ? prop : prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** 路径匹配，支持 "/*"、"/a/*"、"/a/b" */
export function matchPath(pattern: string, path: string): boolean {
  if (!pattern || pattern === '*' || pattern === '/*') return true;
  const re = new RegExp(
    '^' + pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
  );
  return re.test(path);
}

export function throttle<T extends (...a: any[]) => void>(fn: T, wait: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (this: unknown, ...args: any[]) {
    const now = Date.now();
    const remain = wait - (now - last);
    if (remain <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        fn.apply(this, args);
      }, remain);
    }
  } as T;
}

export const RESTRICTED_URL = /^(chrome|edge|about|brave|opera|vivaldi|chrome-extension|moz-extension|safari-web-extension|view-source|devtools|file):/i;
const STORE_HOSTS = ['chrome.google.com', 'chromewebstore.google.com', 'microsoftedge.microsoft.com', 'addons.mozilla.org'];

export function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  if (RESTRICTED_URL.test(url)) return true;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return true;
    return STORE_HOSTS.includes(u.hostname);
  } catch {
    return true;
  }
}

export const hostOf = (url?: string) => {
  try {
    return new URL(url!).hostname;
  } catch {
    return '';
  }
};

export const formatTime = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
