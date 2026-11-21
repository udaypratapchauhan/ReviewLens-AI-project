import { validateAnalysis } from './schema.js';
import { SYSTEM_INSTRUCTION, buildUserPrompt, RESPONSE_SCHEMA } from './prompts.js';

export async function callGemini(reviews, { fetchImpl = fetch } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || !model) throw new Error('GEMINI_API_KEY and GEMINI_MODEL must be set in .env');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const prompt = buildUserPrompt(reviews);

  let res;
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA
        }
      })
    });
  } catch (err) {
    err.retryable = true;
    throw err;
  }

  if (!res.ok) {
    const error = new Error(`Gemini API error: ${res.statusText || res.status}`);
    error.status = res.status;
    if (res.status === 429) {
      const retryAfter = res.headers?.get?.('retry-after') ?? res.headers?.['retry-after'];
      if (retryAfter) {
        const seconds = parseFloat(retryAfter);
        if (!isNaN(seconds)) {
          error.retryAfterMs = seconds * 1000;
        }
      }
    }
    throw error;
  }

  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function parseAndValidateResponse(rawResponse, expectedReviews) {
  const expectedIds = new Set(expectedReviews.map((r) => r.id));
  const seenIds = new Set();
  const valid = new Map();
  const errors = new Map();

  let items = null;
  if (typeof rawResponse === 'string') {
    try {
      items = JSON.parse(rawResponse);
    } catch {
      items = null;
    }
  } else if (Array.isArray(rawResponse)) {
    items = rawResponse;
  }

  if (!Array.isArray(items)) {
    for (const r of expectedReviews) {
      errors.set(r.id, 'Invalid JSON returned from LLM');
    }
    return { valid, errors };
  }

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const { id, ...rest } = item;

    // Ignore unknown and duplicate ids in response
    if (!id || !expectedIds.has(id) || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);

    const validation = validateAnalysis(rest);
    if (validation.ok) {
      valid.set(id, validation.data);
    } else {
      errors.set(id, validation.error);
    }
  }

  // Any expected review not returned is considered missing
  for (const r of expectedReviews) {
    if (!valid.has(r.id) && !errors.has(r.id)) {
      errors.set(r.id, 'Missing from LLM response');
    }
  }

  return { valid, errors };
}

export async function analyzeBatch(reviews, { call = callGemini } = {}) {
  const normalizedReviews = (reviews || []).map((r) => ({
    id: r.id ?? r.review_id,
    text: r.text
  }));

  const results = new Map();
  if (normalizedReviews.length === 0) {
    return results;
  }

  // First call
  const response1 = await call(normalizedReviews);
  const { valid: valid1, errors: errors1 } = parseAndValidateResponse(response1, normalizedReviews);

  for (const [id, data] of valid1.entries()) {
    results.set(id, { status: 'ok', analysis: data });
  }

  // Retry missing or invalid items once
  const toRetry = normalizedReviews.filter((r) => !valid1.has(r.id));
  if (toRetry.length > 0) {
    const response2 = await call(toRetry);
    const { valid: valid2, errors: errors2 } = parseAndValidateResponse(response2, toRetry);

    for (const [id, data] of valid2.entries()) {
      results.set(id, { status: 'ok', analysis: data });
    }

    for (const r of toRetry) {
      if (!valid2.has(r.id)) {
        const errorMsg = errors2.get(r.id) || errors1.get(r.id) || 'Analysis failed';
        results.set(r.id, { status: 'analysis_failed', error: errorMsg });
      }
    }
  }

  return results;
}
