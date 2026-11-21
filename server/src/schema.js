import { z } from 'zod';

export const SENTIMENTS = ['positive', 'neutral', 'negative'];
export const TOPICS = ['quality', 'delivery', 'price', 'packaging', 'support', 'size_fit', 'other'];

const analysisSchema = z
  .object({
    sentiment: z.enum(SENTIMENTS),
    topics: z
      .array(z.enum(TOPICS))
      .nonempty()
      .transform((arr) => Array.from(new Set(arr))),
    summary: z.string().trim().min(1).max(200),
    needs_reply: z.boolean()
  })
  .strict();

export function validateAnalysis(obj) {
  try {
    const result = analysisSchema.safeParse(obj);
    if (result.success) {
      return { ok: true, data: result.data, error: null };
    }

    const error = result.error.issues
      .map((issue) => (issue.path.length ? `${issue.path.join('.')}: ` : '') + issue.message)
      .join('; ');

    return { ok: false, data: null, error };
  } catch (err) {
    return { ok: false, data: null, error: err?.message || 'Validation failed' };
  }
}

const insightItemSchema = z
  .object({
    title: z.string().min(1),
    count: z.number().int().min(0)
  })
  .strict();

export const insightsSchema = z
  .object({
    complaints: z.array(insightItemSchema).max(3),
    praises: z.array(insightItemSchema).max(3)
  })
  .strict();
