import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runAnalysis } from './analysis.js';
import { createCache } from './cache.js';

describe('runAnalysis batching, resilience, and caching', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewlens-analysis-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  const createMockReviews = (count) =>
    Array.from({ length: count }, (_, i) => ({
      id: `R${String(i + 1).padStart(3, '0')}`,
      text: `Review content ${i + 1}`,
      text_hash: `hash_${i + 1}`
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
    const { results } = await runAnalysis(reviews, {
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
    const reviews = createMockReviews(12);

    const error503 = Object.assign(new Error('Service Unavailable'), { status: 503 });

    const mockAnalyze = vi
      .fn()
      .mockImplementationOnce(async (batch) => {
        const res = new Map();
        batch.forEach((r) => res.set(r.id, { status: 'ok', analysis: {} }));
        return res;
      })
      .mockRejectedValueOnce(error503)
      .mockImplementationOnce(async (batch) => {
        const res = new Map();
        batch.forEach((r) => res.set(r.id, { status: 'ok', analysis: {} }));
        return res;
      });

    const sleep = vi.fn();
    const { results } = await runAnalysis(reviews, {
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

    expect(mockAnalyze).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('first run with 7 reviews: ai_calls >= 2, cache_hits 0', async () => {
    const reviews = createMockReviews(7);
    const cache = createCache(path.join(tempDir, 'cache1.json'));

    const mockCall = vi.fn().mockImplementation(async (batch) => {
      return JSON.stringify(
        batch.map((r) => ({
          id: r.id,
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Nice product',
          needs_reply: false
        }))
      );
    });

    const sleep = vi.fn();
    const { results, stats } = await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      call: mockCall,
      sleep,
      cache
    });

    expect(stats.ai_calls).toBeGreaterThanOrEqual(2);
    expect(stats.cache_hits).toBe(0);
    expect(stats.reviews_analysed).toBe(7);
    expect(results.size).toBe(7);
    expect(mockCall).toHaveBeenCalledTimes(2);
  });

  it('second run with the same 7 reviews and the same cache: ai_calls 0, cache_hits 7, and mocked call is never invoked', async () => {
    const reviews = createMockReviews(7);
    const cache = createCache(path.join(tempDir, 'cache2.json'));

    const mockCall = vi.fn().mockImplementation(async (batch) => {
      return JSON.stringify(
        batch.map((r) => ({
          id: r.id,
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Nice product',
          needs_reply: false
        }))
      );
    });

    const sleep = vi.fn();

    // First run populates the cache
    await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      call: mockCall,
      sleep,
      cache
    });

    mockCall.mockClear();

    // Second run
    const { results, stats } = await runAnalysis(reviews, {
      batchSize: 5,
      delayMs: 1000,
      call: mockCall,
      sleep,
      cache
    });

    expect(stats.ai_calls).toBe(0);
    expect(stats.cache_hits).toBe(7);
    expect(stats.reviews_analysed).toBe(7);
    expect(mockCall).not.toHaveBeenCalled();

    for (const r of reviews) {
      expect(results.get(r.id).from_cache).toBe(true);
    }
  });

  it('analysis_failed results are not written to the cache', async () => {
    const reviews = [{ id: 'R001', text: 'Bad review', text_hash: 'hash_fail' }];
    const cache = createCache(path.join(tempDir, 'fail_cache.json'));

    const mockCall = vi.fn().mockResolvedValue('invalid json response');
    const sleep = vi.fn();

    const { results } = await runAnalysis(reviews, {
      call: mockCall,
      sleep,
      cache
    });

    expect(results.get('R001').status).toBe('analysis_failed');
    expect(cache.get('hash_fail')).toBeUndefined();
  });

  it('a mix of 3 cached and 4 new reviews sends only 4 to the LLM', async () => {
    const reviews = createMockReviews(7);
    const cache = createCache(path.join(tempDir, 'mixed_cache.json'));

    // Pre-cache 3 reviews: R001, R002, R003
    for (let i = 0; i < 3; i++) {
      cache.set(reviews[i].text_hash, {
        sentiment: 'positive',
        topics: ['quality'],
        summary: `Cached summary ${i + 1}`,
        needs_reply: false
      });
    }

    const mockCall = vi.fn().mockImplementation(async (batch) => {
      return JSON.stringify(
        batch.map((r) => ({
          id: r.id,
          sentiment: 'neutral',
          topics: ['price'],
          summary: `Fresh summary ${r.id}`,
          needs_reply: false
        }))
      );
    });

    const sleep = vi.fn();
    const { results, stats } = await runAnalysis(reviews, {
      batchSize: 5,
      call: mockCall,
      sleep,
      cache
    });

    expect(stats.cache_hits).toBe(3);
    expect(stats.ai_calls).toBe(1); // 4 reviews fit in a single batch of 5
    expect(mockCall).toHaveBeenCalledTimes(1);

    const sentBatch = mockCall.mock.calls[0][0];
    expect(sentBatch.length).toBe(4);
    expect(sentBatch.map((r) => r.id)).toEqual(['R004', 'R005', 'R006', 'R007']);

    expect(results.get('R001').from_cache).toBe(true);
    expect(results.get('R004').from_cache).toBeUndefined();
    expect(results.get('R004').analysis.sentiment).toBe('neutral');
  });

  it('returns status "ok" results even if cache save() throws an error', async () => {
    const reviews = [{ id: 'R001', text: 'Great review', text_hash: 'hash_save_err' }];

    const faultyCache = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      save: vi.fn().mockImplementation(() => {
        throw new Error('Disk full: EACCES');
      })
    };

    const mockCall = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          id: 'R001',
          sentiment: 'positive',
          topics: ['quality'],
          summary: 'Great review',
          needs_reply: false
        }
      ])
    );

    const sleep = vi.fn();
    const { results, stats } = await runAnalysis(reviews, {
      call: mockCall,
      sleep,
      cache: faultyCache
    });

    expect(faultyCache.save).toHaveBeenCalled();
    expect(results.get('R001').status).toBe('ok');
    expect(results.get('R001').analysis.sentiment).toBe('positive');
    expect(stats.reviews_analysed).toBe(1);
  });
});
