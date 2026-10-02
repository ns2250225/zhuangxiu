import { z } from 'zod';

const styles = z.record(z.string(), z.union([z.string(), z.number()]).transform(String));

export const RuleSchema = z.object({
  id: z.string().max(64).optional(),
  selector: z.string().min(1).max(800),
  styles,
  enabled: z.boolean().optional().default(true),
  source: z.enum(['ai', 'manual', 'preset', 'import']).optional(),
  priority: z.number().optional().default(0),
  action: z.enum(['remove']).optional(),
  note: z.string().max(200).optional(),
});

export const CodePayloadSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().max(100).default('未命名装修'),
  host: z.string().max(253).default(''),
  pathPattern: z.string().max(300).default('/*'),
  rules: z.array(RuleSchema).max(500),
  createdAt: z.number().default(() => Date.now()),
});

/** AI 返回的 JSON —— 宽松解析，随后再过安全清洗；字段可选以容忍输出被截断 */
export const AIResponseSchema = z.object({
  name: z.string().max(100).optional(),
  explanation: z.union([z.string(), z.array(z.string())]).optional(),
  rules: z
    .array(
      z.object({
        id: z.string().optional(),
        selector: z.string().optional(),
        styles: z.record(z.string(), z.unknown()).optional(),
        note: z.string().optional(),
      }),
    )
    .default([]),
  removeIds: z.array(z.string()).optional().default([]),
});

export const BackupSchema = z.object({
  app: z.literal('pagestyler-ai'),
  version: z.number(),
  decorations: z.record(z.string(), z.array(z.any())),
});
