import { describe, it, expect } from 'vitest';
import { validateAnalysis, SENTIMENTS, TOPICS, insightsSchema } from './schema.js';

describe('validateAnalysis', () => {
  const validBase = {
    sentiment: 'positive',
    topics: ['quality'],
    summary: 'Great product and quick delivery.',
    needs_reply: false
  };

  // 1. valid object passes
  it('passes for a valid analysis object', () => {
    const res = validateAnalysis(validBase);
    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.data).toEqual(validBase);
  });

  // 2. sentiment outside the list fails
  it('fails when sentiment is outside SENTIMENTS', () => {
    const res = validateAnalysis({ ...validBase, sentiment: 'ecstatic' });
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 3. topic outside the list fails
  it('fails when a topic is outside TOPICS', () => {
    const res = validateAnalysis({ ...validBase, topics: ['shipping'] });
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 4. empty topics array fails
  it('fails when topics array is empty', () => {
    const res = validateAnalysis({ ...validBase, topics: [] });
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 5. missing field fails
  it('fails when a required field is missing', () => {
    const { needs_reply, ...missingNeedsReply } = validBase;
    const res = validateAnalysis(missingNeedsReply);
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 6. extra field fails
  it('fails when an extra field is present', () => {
    const res = validateAnalysis({ ...validBase, id: 'R001' });
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 7. needs_reply "true" (string) fails
  it('fails when needs_reply is a string "true"', () => {
    const res = validateAnalysis({ ...validBase, needs_reply: 'true' });
    expect(res.ok).toBe(false);
    expect(res.data).toBeNull();
    expect(typeof res.error).toBe('string');
  });

  // 8. summary empty or over 200 chars fails
  it('fails when summary is empty, whitespace only, or exceeds 200 characters', () => {
    const emptyRes = validateAnalysis({ ...validBase, summary: '' });
    expect(emptyRes.ok).toBe(false);
    expect(emptyRes.data).toBeNull();

    const whitespaceRes = validateAnalysis({ ...validBase, summary: '   ' });
    expect(whitespaceRes.ok).toBe(false);
    expect(whitespaceRes.data).toBeNull();

    const tooLongRes = validateAnalysis({ ...validBase, summary: 'a'.repeat(201) });
    expect(tooLongRes.ok).toBe(false);
    expect(tooLongRes.data).toBeNull();

    const maxLengthRes = validateAnalysis({ ...validBase, summary: 'a'.repeat(200) });
    expect(maxLengthRes.ok).toBe(true);
  });

  // 9. null / undefined / string / array input returns ok false without throwing
  it('returns ok false without throwing for null, undefined, string, or array input', () => {
    const inputs = [null, undefined, 'some string', [1, 2, 3]];

    inputs.forEach((input) => {
      expect(() => {
        const res = validateAnalysis(input);
        expect(res.ok).toBe(false);
        expect(res.data).toBeNull();
        expect(typeof res.error).toBe('string');
      }).not.toThrow();
    });
  });

  // 10. duplicate topics are removed
  it('removes duplicate topics in the returned data', () => {
    const res = validateAnalysis({
      ...validBase,
      topics: ['quality', 'delivery', 'quality', 'delivery', 'price']
    });

    expect(res.ok).toBe(true);
    expect(res.error).toBeNull();
    expect(res.data.topics).toEqual(['quality', 'delivery', 'price']);
  });
});

describe('insightsSchema validation', () => {
  const validInsights = {
    complaints: [
      { title: 'Broken handle', count: 5 },
      { title: 'Late delivery', count: 2 }
    ],
    praises: [{ title: 'Soft fabric', count: 12 }]
  };

  it('valid insights object passes', () => {
    const res = insightsSchema.safeParse(validInsights);
    expect(res.success).toBe(true);
  });

  it('rejects string count or negative count', () => {
    const stringCount = {
      ...validInsights,
      complaints: [{ title: 'Broken handle', count: '5' }]
    };
    expect(insightsSchema.safeParse(stringCount).success).toBe(false);

    const negativeCount = {
      ...validInsights,
      complaints: [{ title: 'Broken handle', count: -1 }]
    };
    expect(insightsSchema.safeParse(negativeCount).success).toBe(false);
  });

  it('rejects more than 3 complaints or praises', () => {
    const tooManyComplaints = {
      ...validInsights,
      complaints: [
        { title: 'c1', count: 1 },
        { title: 'c2', count: 2 },
        { title: 'c3', count: 3 },
        { title: 'c4', count: 4 }
      ]
    };
    expect(insightsSchema.safeParse(tooManyComplaints).success).toBe(false);
  });

  it('rejects extra fields', () => {
    const extraField = { ...validInsights, extra: 'not allowed' };
    expect(insightsSchema.safeParse(extraField).success).toBe(false);
  });
});
