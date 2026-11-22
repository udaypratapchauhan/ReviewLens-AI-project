import { describe, it, expect } from 'vitest';
import { filterReviews } from './filters.js';

describe('filterReviews', () => {
  const sampleReviews = [
    {
      review_id: 'R001',
      product: 'Wireless Earbuds',
      analysis: { sentiment: 'positive', topics: ['quality', 'sound'] }
    },
    {
      review_id: 'R002',
      product: 'Running Shoes',
      analysis: { sentiment: 'negative', topics: ['size_fit', 'delivery'] }
    },
    {
      review_id: 'R003',
      product: 'Running Shoes',
      analysis: { sentiment: 'neutral', topics: ['delivery'] }
    },
    {
      review_id: 'R004',
      product: 'Coffee Mug',
      analysis: null
    }
  ];

  it('returns all reviews when filters are "All" or omitted', () => {
    expect(filterReviews(sampleReviews)).toHaveLength(4);
    expect(filterReviews(sampleReviews, { product: 'All', sentiment: 'All', topic: 'All' })).toHaveLength(4);
  });

  it('filters by product correctly', () => {
    const res = filterReviews(sampleReviews, { product: 'Running Shoes' });
    expect(res.map((r) => r.review_id)).toEqual(['R002', 'R003']);
  });

  it('filters by sentiment correctly (case-insensitive)', () => {
    const res = filterReviews(sampleReviews, { sentiment: 'Negative' });
    expect(res.map((r) => r.review_id)).toEqual(['R002']);
  });

  it('filters by topic correctly', () => {
    const res = filterReviews(sampleReviews, { topic: 'delivery' });
    expect(res.map((r) => r.review_id)).toEqual(['R002', 'R003']);
  });

  it('combines multiple filters and returns matching reviews or empty list', () => {
    const match = filterReviews(sampleReviews, {
      product: 'Running Shoes',
      sentiment: 'negative',
      topic: 'size_fit'
    });
    expect(match.map((r) => r.review_id)).toEqual(['R002']);

    const noMatch = filterReviews(sampleReviews, {
      product: 'Wireless Earbuds',
      sentiment: 'negative'
    });
    expect(noMatch).toEqual([]);
  });

  it('handles invalid or empty review lists gracefully', () => {
    expect(filterReviews([])).toEqual([]);
    expect(filterReviews(null)).toEqual([]);
    expect(filterReviews(undefined)).toEqual([]);
  });
});
