import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createApp, createMemoryStore } from './app.js';
import { createCache } from './cache.js';
import { runAnalysis } from './analysis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const realCsvBuffer = fs.readFileSync(path.resolve(__dirname, '../../data/reviews.csv'));

describe('Express API Endpoints', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewlens-routes-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('upload of the real data/reviews.csv returns 30 reviews, cleaning_report with to_analyse 28, and R005 skipped_empty, R015 duplicate with R012 analysis', async () => {
    const store = createMemoryStore();
    const cache = createCache(path.join(tempDir, 'cache1.json'));

    const mockRunAnalysis = vi.fn().mockImplementation(async (reviews) => {
      const results = new Map();
      for (const r of reviews) {
        results.set(r.id, {
          status: 'ok',
          analysis: {
            sentiment: r.id === 'R012' ? 'negative' : 'positive',
            topics: ['quality'],
            summary: `Summary for ${r.id}`,
            needs_reply: r.id === 'R012'
          }
        });
      }
      return {
        results,
        stats: { ai_calls: 2, cache_hits: 0, reviews_analysed: reviews.length, total_ms: 100 }
      };
    });

    const app = createApp({ cache, store, runAnalysisFn: mockRunAnalysis });

    const res = await request(app)
      .post('/api/upload')
      .attach('file', realCsvBuffer, 'reviews.csv');

    expect(res.status).toBe(200);
    expect(res.body.reviews).toHaveLength(30);
    expect(res.body.cleaning_report.total).toBe(30);
    expect(res.body.cleaning_report.to_analyse).toBe(28);

    const r005 = res.body.reviews.find((r) => r.review_id === 'R005');
    expect(r005.analysis_status).toBe('skipped_empty');
    expect(r005.analysis).toBeNull();

    const r012 = res.body.reviews.find((r) => r.review_id === 'R012');
    const r015 = res.body.reviews.find((r) => r.review_id === 'R015');
    expect(r012.analysis_status).toBe('ok');
    expect(r015.analysis_status).toBe('duplicate');
    expect(r015.analysis).toEqual(r012.analysis);
  });

  it('upload with no file returns 400, a .txt file returns 400', async () => {
    const app = createApp();

    const resNoFile = await request(app).post('/api/upload');
    expect(resNoFile.status).toBe(400);
    expect(resNoFile.body.error).toContain('CSV file is required');

    const resTxt = await request(app)
      .post('/api/upload')
      .attach('file', Buffer.from('hello world'), 'notes.txt');
    expect(resTxt.status).toBe(400);
    expect(resTxt.body.error).toContain('.csv');
  });

  it('second upload of the same file reports ai_calls 0 using a temp cache file', async () => {
    const cache = createCache(path.join(tempDir, 'cache_persist.json'));
    const store = createMemoryStore();

    const mockCall = vi.fn().mockImplementation(async (batch) => {
      return JSON.stringify(
        batch.map((r) => ({
          id: r.id,
          sentiment: 'positive',
          topics: ['quality'],
          summary: `Summary for ${r.id}`,
          needs_reply: false
        }))
      );
    });

    const runAnalysisWithMock = (reviews, opts) =>
      runAnalysis(reviews, { ...opts, call: mockCall, delayMs: 0 });

    const app = createApp({ cache, store, runAnalysisFn: runAnalysisWithMock });

    // First upload
    const res1 = await request(app)
      .post('/api/upload')
      .attach('file', realCsvBuffer, 'reviews.csv');

    expect(res1.status).toBe(200);
    expect(res1.body.stats.ai_calls).toBeGreaterThanOrEqual(1);
    expect(res1.body.stats.cache_hits).toBe(0);

    mockCall.mockClear();

    // Second upload of the same CSV
    const res2 = await request(app)
      .post('/api/upload')
      .attach('file', realCsvBuffer, 'reviews.csv');

    expect(res2.status).toBe(200);
    expect(res2.body.stats.ai_calls).toBe(0);
    expect(res2.body.stats.cache_hits).toBe(28);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('/api/reply returns 400 for a review that does not need a reply', async () => {
    const store = createMemoryStore();
    const mockGenerateReply = vi.fn().mockResolvedValue('Thank you for your feedback.');
    const app = createApp({ store, generateReplyFn: mockGenerateReply });

    // Seed store with an upload result where R001 needs_reply is false, R012 needs_reply is true
    store.setLatest({
      reviews: [
        {
          review_id: 'R001',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'positive',
            topics: ['quality'],
            summary: 'Great bedsheet',
            needs_reply: false
          }
        },
        {
          review_id: 'R012',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['quality'],
            summary: 'Earbud stopped working',
            needs_reply: true
          }
        }
      ],
      stats: {},
      cleaning_report: {}
    });

    // R001 does not need reply -> 400
    const resR001 = await request(app).post('/api/reply').send({ review_id: 'R001' });
    expect(resR001.status).toBe(400);
    expect(resR001.body.error).toContain('does not need a reply');

    // R012 needs reply -> 200
    const resR012 = await request(app).post('/api/reply').send({ review_id: 'R012' });
    expect(resR012.status).toBe(200);
    expect(resR012.body.review_id).toBe('R012');
    expect(resR012.body.reply).toBe('Thank you for your feedback.');
  });

  it('/api/insights uses the fallback when the LLM call throws', async () => {
    const store = createMemoryStore();
    const mockGenerateInsights = vi.fn().mockRejectedValue(new Error('LLM call failed'));
    const app = createApp({ store, generateInsightsFn: mockGenerateInsights });

    store.setLatest({
      reviews: [
        {
          review_id: 'R001',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'positive',
            topics: ['quality', 'delivery'],
            summary: 'Praise 1'
          }
        },
        {
          review_id: 'R002',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['quality', 'packaging'],
            summary: 'Complaint 1'
          }
        },
        {
          review_id: 'R003',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['quality'],
            summary: 'Complaint 2'
          }
        }
      ],
      stats: {},
      cleaning_report: {}
    });

    const res = await request(app).post('/api/insights');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.complaints).toEqual([
      { title: 'quality', count: 2 },
      { title: 'packaging', count: 1 }
    ]);
    expect(res.body.praises).toEqual([
      { title: 'delivery', count: 1 },
      { title: 'quality', count: 1 }
    ]);
  });

  it('returns 502 with AI service authentication failed when runAnalysis throws 401 or 403', async () => {
    const mockRunAnalysis = vi.fn().mockRejectedValue(
      Object.assign(new Error('Invalid secret key: 12345'), { status: 401 })
    );

    const app = createApp({ runAnalysisFn: mockRunAnalysis });

    const res = await request(app)
      .post('/api/upload')
      .attach('file', realCsvBuffer, 'reviews.csv');

    expect(res.status).toBe(502);
    expect(res.body.error).toBe('AI service authentication failed');
    expect(JSON.stringify(res.body)).not.toContain('12345');
  });

  it('returns 404 for unknown endpoints and when no upload exists for reply/insights', async () => {
    const app = createApp();

    const resUnknown = await request(app).get('/api/does_not_exist');
    expect(resUnknown.status).toBe(404);
    expect(resUnknown.body.error).toBe('Not found');

    const resNoUploadReply = await request(app).post('/api/reply').send({ review_id: 'R001' });
    expect(resNoUploadReply.status).toBe(404);
    expect(resNoUploadReply.body.error).toBe('No upload found');

    const resNoUploadInsights = await request(app).post('/api/insights');
    expect(resNoUploadInsights.status).toBe(404);
    expect(resNoUploadInsights.body.error).toBe('No upload found');
  });

  it('/api/insights uses the fallback when AI shape is invalid (count is a string)', async () => {
    const store = createMemoryStore();
    const mockGenerateInsights = vi.fn().mockResolvedValue({
      complaints: [{ title: 'Slow delivery', count: '5' }], // invalid: count is string
      praises: [{ title: 'Good quality', count: 10 }]
    });
    const app = createApp({ store, generateInsightsFn: mockGenerateInsights });

    store.setLatest({
      reviews: [
        {
          review_id: 'R001',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['delivery'],
            summary: 'Slow delivery'
          }
        }
      ],
      stats: {},
      cleaning_report: {}
    });

    const res = await request(app).post('/api/insights');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.complaints).toEqual([{ title: 'delivery', count: 1 }]);
  });

  it('fallback never contains the topic "other"', async () => {
    const store = createMemoryStore();
    const mockGenerateInsights = vi.fn().mockRejectedValue(new Error('AI failed'));
    const app = createApp({ store, generateInsightsFn: mockGenerateInsights });

    store.setLatest({
      reviews: [
        {
          review_id: 'R001',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['other', 'price'],
            summary: 'Random complaint'
          }
        },
        {
          review_id: 'R002',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'positive',
            topics: ['other'],
            summary: 'Random praise'
          }
        }
      ],
      stats: {},
      cleaning_report: {}
    });

    const res = await request(app).post('/api/insights');
    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(res.body.complaints.some((c) => c.title === 'other')).toBe(false);
    expect(res.body.praises.some((p) => p.title === 'other')).toBe(false);
    expect(res.body.complaints).toEqual([{ title: 'price', count: 1 }]);
    expect(res.body.praises).toEqual([]);
  });

  it('/api/reply returns 502 with friendly message when generateReplyFn throws an error with status 503', async () => {
    const store = createMemoryStore();
    const error503 = Object.assign(new Error('503 Service Unavailable upstream'), { status: 503 });
    const mockGenerateReply = vi.fn().mockRejectedValue(error503);
    const app = createApp({ store, generateReplyFn: mockGenerateReply });

    store.setLatest({
      reviews: [
        {
          review_id: 'R012',
          analysis_status: 'ok',
          analysis: {
            sentiment: 'negative',
            topics: ['quality'],
            summary: 'Earbud stopped working',
            needs_reply: true
          }
        }
      ],
      stats: {},
      cleaning_report: {}
    });

    const res = await request(app).post('/api/reply').send({ review_id: 'R012' });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('AI service unavailable, please try again');
  });
});
