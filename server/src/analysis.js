import { callGemini, analyzeBatch } from './llm.js';
import { withBackoff } from './retry.js';

export async function runAnalysis(
  reviews,
  {
    batchSize = 5,
    delayMs = 6000,
    analyze = analyzeBatch,
    call,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    cache
  } = {}
) {
  const startTime = Date.now();
  const results = new Map();
  let ai_calls = 0;
  let cache_hits = 0;

  if (!reviews || reviews.length === 0) {
    return {
      results,
      stats: {
        ai_calls: 0,
        cache_hits: 0,
        reviews_analysed: 0,
        total_ms: Date.now() - startTime
      }
    };
  }

  // Check cache for each review
  const misses = [];
  for (const review of reviews) {
    const hash = review.text_hash;
    const cachedAnalysis = cache && hash ? cache.get(hash) : undefined;
    if (cachedAnalysis) {
      cache_hits++;
      results.set(review.id, {
        status: 'ok',
        analysis: cachedAnalysis,
        from_cache: true
      });
    } else {
      misses.push(review);
    }
  }

  // Partition misses into batches
  const batches = [];
  for (let i = 0; i < misses.length; i += batchSize) {
    batches.push(misses.slice(i, i + batchSize));
  }

  const baseCallFn = call || ((b) => withBackoff(() => callGemini(b)));
  const instrumentedCall = async (b) => {
    ai_calls++;
    return await baseCallFn(b);
  };

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const batchResults = await analyze(batch, { call: instrumentedCall });
      for (const [id, res] of batchResults) {
        results.set(id, res);
        const review = batch.find((r) => r.id === id);
        if (res.status === 'ok' && cache && review?.text_hash) {
          cache.set(review.text_hash, res.analysis);
        }
      }

      if (cache) {
        try {
          cache.save();
        } catch {
          // Disk write error does not invalidate good results
        }
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        throw err;
      }
      console.error(`batch failed: ${err?.status} ${err?.message}`);
      for (const review of batch) {
        results.set(review.id, {
          status: 'analysis_failed',
          error: err?.message || 'Analysis failed'
        });
      }
    }

    if (i < batches.length - 1 && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  let reviews_analysed = 0;
  for (const r of results.values()) {
    if (r.status === 'ok') {
      reviews_analysed++;
    }
  }

  return {
    results,
    stats: {
      ai_calls,
      cache_hits,
      reviews_analysed,
      total_ms: Date.now() - startTime
    }
  };
}
