import { describe, it, expect, vi } from 'vitest';
import { runAnalysis } from './analysis.js';

describe('runAnalysis batching and resilience', () => {
  const createMockReviews = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `R${String(i + 1).padStart(3, '0')}`,
      text: `Review content ${i + 1}`
    }));

  it('produces exactly 3 batches of 5, 5, 2 in order for 12 reviews', async () => {
    const reviews = createMockReviews(12);
    const capturedBatches = [];

    const mockAnalyze = vi.fn().mockImplementation(async (batch) => {
      capturedBatches.push(batch);
      const res = new Map();
      batch.forEach((r) => {
        res.set(r.id, {
          status: 'ok',
          analysis: {
            sentiment: 'positive',
            topics: ['quality'],
            summary: 'Good',
            needs_reply: false
          }
        });
      });
      return res;
    });

    const sleep = vi.fn();
    const results = await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      analyze: mockAnalyze,
      sleep
    });

    expect(mockAnalyze).toHaveBeenCalledTimes(3);
    expect(capturedBatches.length).toBe(3);
    expect(capturedBatches[0].map((r) => r.id)).toEqual(['R001', 'R002', 'R003', 'R004', 'R005']);
    expect(capturedBatches[1].map((r) => r.id)).toEqual(['R006', 'R007', 'R008', 'R009', 'R010']);
    expect(capturedBatches[2].map((r) => r.id)).toEqual(['R011', 'R012']);

    expect(results.size).toBe(12);
    expect(results.get('R001').status).toBe('ok');
    expect(results.get('R012').status).toBe('ok');
  });

  it('calls sleep between batches only (2 times for 3 batches)', async () => {
    const reviews = createMockReviews(12);

    const mockAnalyze = vi.fn().mockImplementation(async (batch) => {
      const res = new Map();
      batch.forEach((r) => {
        res.set(r.id, { status: 'ok', analysis: {} });
      });
      return res;
    });

    const sleep = vi.fn();
    await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      analyze: mockAnalyze,
      sleep
    });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 1000);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
  });

  it('marks batch reviews as analysis_failed when batch fails with 503 and lets other batches succeed', async () => {
    const reviews = createMockReviews(12); // 3 batches: [R1-R5], [R6-R10], [R11-R12]

    const error503 = Object.assign(new Error('Service Unavailable'), { status: 503 });

    const mockAnalyze = vi
      .fn()
      .mockImplementationOnce(async (batch) => {
        const res = new Map();
        batch.forEach((r) => res.set(r.id, { status: 'ok', analysis: {} }));
        return res;
      })
      .mockRejectedValueOnce(error503) // second batch fails
      .mockImplementationOnce(async (batch) => {
        const res = new Map();
        batch.forEach((r) => res.set(r.id, { status: 'ok', analysis: {} }));
        return res;
      });

    const sleep = vi.fn();
    const results = await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      analyze: mockAnalyze,
      sleep
    });

    expect(mockAnalyze).toHaveBeenCalledTimes(3);

    // Batch 1 succeeded
    expect(results.get('R001').status).toBe('ok');
    expect(results.get('R005').status).toBe('ok');

    // Batch 2 failed
    expect(results.get('R006').status).toBe('analysis_failed');
    expect(results.get('R006').error).toContain('Service Unavailable');
    expect(results.get('R010').status).toBe('analysis_failed');

    // Batch 3 succeeded
    expect(results.get('R011').status).toBe('ok');
    expect(results.get('R012').status).toBe('ok');
  });

  it('stops the run and throws when a 401 is encountered', async () => {
    const reviews = createMockReviews(12);

    const error401 = Object.assign(new Error('Unauthorized: Invalid API key'), { status: 401 });
    const mockAnalyze = vi.fn().mockRejectedValue(error401);

    const sleep = vi.fn();
    await expect(
      runAnalysis(reviews, {
        batchSize: 5,
        delayMs: 1000,
        analyze: mockAnalyze,
        sleep
      })
    ).rejects.toMatchObject({
      status: 401
    });

    // Run must halt immediately
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });
});
