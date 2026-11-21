import { callGemini, analyzeBatch } from './llm.js';
import { withBackoff } from './retry.js';

export async function runAnalysis(
  reviews,
  {
    batchSize = 5,
    delayMs = 1000,
    analyze = analyzeBatch,
    call,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  } = {}
) {
  const results = new Map();
  if (!reviews || reviews.length === 0) {
    return results;
  }

  const batches = [];
  for (let i = 0; i < reviews.length; i += batchSize) {
    batches.push(reviews.slice(i, i + batchSize));
  }

  const callFn = call || ((b) => withBackoff(() => callGemini(b)));

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const batchResults = await analyze(batch, { call: callFn });
      for (const [id, res] of batchResults) {
        results.set(id, res);
      }
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        throw err;
      }
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

  return results;
}
