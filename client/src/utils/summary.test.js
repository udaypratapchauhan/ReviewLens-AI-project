import { describe, it, expect } from 'vitest';
import { computeSummary } from './summary.js';

describe('computeSummary pure function', () => {
  it('returns 0 for all counts and percentages when review list is empty or undefined', () => {
    const emptyResult = computeSummary([]);
    expect(emptyResult).toEqual({
      total_analysed: 0,
      positive_pct: 0,
      neutral_pct: 0,
      negative_pct: 0,
      needs_reply_count: 0,
      skipped_empty: 0,
      duplicates: 0,
      analysis_failed: 0
    });

    const undefinedResult = computeSummary(undefined);
    expect(undefinedResult.total_analysed).toBe(0);
  });

  it('calculates counts and rounded percentages for analysed reviews and counts needs_reply', () => {
    const reviews = [
      {
        review_id: 'R1',
        analysis_status: 'ok',
        analysis: { sentiment: 'positive', needs_reply: false }
      },
      {
        review_id: 'R2',
        analysis_status: 'ok',
        analysis: { sentiment: 'positive', needs_reply: false }
      },
      {
        review_id: 'R3',
        analysis_status: 'ok',
        analysis: { sentiment: 'neutral', needs_reply: false }
      },
      {
        review_id: 'R4',
        analysis_status: 'ok',
        analysis: { sentiment: 'negative', needs_reply: true }
      }
    ];

    const result = computeSummary(reviews);
    expect(result.total_analysed).toBe(4);
    // 2/4 = 50%
    expect(result.positive_pct).toBe(50);
    // 1/4 = 25%
    expect(result.neutral_pct).toBe(25);
    // 1/4 = 25%
    expect(result.negative_pct).toBe(25);
    expect(result.needs_reply_count).toBe(1);
    expect(result.skipped_empty).toBe(0);
    expect(result.duplicates).toBe(0);
    expect(result.analysis_failed).toBe(0);
  });

  it('excludes duplicates, skipped_empty, and analysis_failed from percentages while counting them in small cards', () => {
    const reviews = [
      {
        review_id: 'R1',
        analysis_status: 'ok',
        analysis: { sentiment: 'positive', needs_reply: false }
      },
      {
        review_id: 'R2',
        analysis_status: 'ok',
        analysis: { sentiment: 'negative', needs_reply: true }
      },
      // Duplicate should NOT count towards total_analysed or percentages
      {
        review_id: 'R3',
        analysis_status: 'duplicate',
        duplicate_of: 'R2',
        analysis: { sentiment: 'negative', needs_reply: true }
      },
      // Skipped empty
      {
        review_id: 'R4',
        analysis_status: 'skipped_empty',
        analysis: null
      },
      // Failed analysis
      {
        review_id: 'R5',
        analysis_status: 'analysis_failed',
        analysis: null
      }
    ];

    const result = computeSummary(reviews);
    // Only R1 and R2 are counted in total_analysed
    expect(result.total_analysed).toBe(2);
    // 1/2 = 50% positive, 1/2 = 50% negative
    expect(result.positive_pct).toBe(50);
    expect(result.negative_pct).toBe(50);
    expect(result.neutral_pct).toBe(0);
    expect(result.needs_reply_count).toBe(1);

    // Small card counters
    expect(result.duplicates).toBe(1);
    expect(result.skipped_empty).toBe(1);
    expect(result.analysis_failed).toBe(1);
  });
});
