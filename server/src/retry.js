function isRetryable(err) {
  if (!err) return false;
  if (err.status === 429) return true;
  if (typeof err.status === 'number' && err.status >= 500) return true;
  if (err.retryable === true) return true;
  return false;
}

export async function withBackoff(
  fn,
  {
    retries = 4,
    baseMs = 1000,
    maxMs = 30000,
    sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random
  } = {}
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !isRetryable(err)) {
        throw err;
      }

      const baseDelay = Math.min(maxMs, baseMs * 2 ** attempt);
      const jitter = baseDelay * (random() * 0.25);
      let delay = baseDelay + jitter;

      if (typeof err.retryAfterMs === 'number' && !isNaN(err.retryAfterMs)) {
        delay = Math.max(delay, err.retryAfterMs);
      }

      await sleep(delay);
    }
  }
}
