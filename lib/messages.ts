import type { AIConfig, PageStatus } from './types';
import type { ChatTurn } from './ai/client';

export type PanelTab = 'ai' | 'preset' | 'picker' | 'rules' | 'code';

/** content / popup → background */
export type BgMessage =
  | { type: 'ai:chat'; messages: ChatTurn[] }
  | { type: 'ai:test'; config?: AIConfig }
  | { type: 'open-options' };

export type BgResponse = { ok: true; content: string } | { ok: false; error: string };

/** popup / background → content */
export type TabMessage =
  | { type: 'panel:open'; tab?: PanelTab }
  | { type: 'panel:toggle' }
  | { type: 'toggle-original' }
  | { type: 'picker:start' }
  | { type: 'status:get' }
  | { type: 'mascot:show' };

export type StatusResponse = PageStatus;
