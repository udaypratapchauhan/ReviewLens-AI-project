import express from 'express';
import multer from 'multer';
import { parseAndCleanReviews } from './cleaning.js';
import { runAnalysis } from './analysis.js';
import { generateReply, generateInsights } from './llm.js';
import { insightsSchema } from './schema.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1 MB limit
  fileFilter: (req, file, cb) => {
    const isCsvExt = file.originalname && file.originalname.toLowerCase().endsWith('.csv');
    const isCsvMime = file.mimetype === 'text/csv' || file.mimetype === 'application/csv';
    if (isCsvExt || isCsvMime) {
      cb(null, true);
    } else {
      const err = new Error('Only .csv files are allowed');
      err.status = 400;
      cb(err);
    }
  }
});

function getTopTopics(reviewsList) {
  const counts = {};
  for (const r of reviewsList) {
    for (const topic of r.analysis?.topics || []) {
      if (topic === 'other') continue;
      counts[topic] = (counts[topic] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([title, count]) => ({ title, count }));
}

export function createRoutes({
  cache,
  store,
  runAnalysisFn = runAnalysis,
  generateReplyFn = generateReply,
  generateInsightsFn = generateInsights
} = {}) {
  const router = express.Router();

  router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/upload', upload.single('file'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const csvText = req.file.buffer.toString('utf8');
      const { reviews: cleanedReviews, report: cleaning_report } = parseAndCleanReviews(csvText);

      const toAnalyse = cleanedReviews
        .filter((r) => r.status === 'to_analyse')
        .map((r) => ({ id: r.review_id, text: r.text, text_hash: r.text_hash }));

      let analysisResults = new Map();
      let stats = { ai_calls: 0, cache_hits: 0, reviews_analysed: 0, total_ms: 0 };

      try {
        const runRes = await runAnalysisFn(toAnalyse, { cache });
        analysisResults = runRes.results;
        stats = runRes.stats;
      } catch (err) {
        if (err?.status === 401 || err?.status === 403) {
          return res.status(502).json({ error: 'AI service authentication failed' });
        }
        throw err;
      }

      const mergedReviews = [];
      for (const r of cleanedReviews) {
        if (r.status === 'skipped_empty') {
          mergedReviews.push({
            ...r,
            analysis: null,
            analysis_status: 'skipped_empty'
          });
        } else if (r.status === 'malformed') {
          mergedReviews.push({
            ...r,
            analysis: null,
            analysis_status: 'malformed'
          });
        } else if (r.status === 'to_analyse') {
          const ar = analysisResults.get(r.review_id);
          if (ar?.status === 'ok') {
            mergedReviews.push({
              ...r,
              analysis: ar.analysis,
              analysis_status: 'ok'
            });
          } else {
            mergedReviews.push({
              ...r,
              analysis: null,
              analysis_status: 'analysis_failed'
            });
          }
        } else if (r.status === 'duplicate') {
          mergedReviews.push({
            ...r,
            analysis: null,
            analysis_status: 'duplicate'
          });
        }
      }

      // Copy analysis from the original review for duplicates
      const reviewMap = new Map(mergedReviews.map((r) => [r.review_id, r]));
      for (const r of mergedReviews) {
        if (r.status === 'duplicate') {
          const orig = reviewMap.get(r.duplicate_of);
          r.analysis = orig?.analysis || null;
        }
      }

      const responseData = { reviews: mergedReviews, stats, cleaning_report };
      if (store) {
        store.setLatest(responseData);
      }

      res.json(responseData);
    } catch (err) {
      next(err);
    }
  });

  router.post('/reply', async (req, res, next) => {
    try {
      const { review_id } = req.body || {};
      const latest = store?.getLatest();
      if (!latest) {
        return res.status(404).json({ error: 'No upload found' });
      }

      const review = latest.reviews.find((r) => r.review_id === review_id);
      if (!review) {
        return res.status(404).json({ error: 'Review not found' });
      }

      if (review.analysis_status !== 'ok' || !review.analysis?.needs_reply) {
        return res.status(400).json({ error: 'Review does not need a reply' });
      }

      const reply = await generateReplyFn(review);
      res.json({ review_id, reply });
    } catch (err) {
      next(err);
    }
  });

  router.post('/insights', async (req, res, next) => {
    try {
      const latest = store?.getLatest();
      if (!latest) {
        return res.status(404).json({ error: 'No upload found' });
      }

      const analysedReviews = latest.reviews.filter(
        (r) => r.analysis_status === 'ok' && r.analysis
      );

      const negativeReviews = analysedReviews.filter((r) => r.analysis.sentiment === 'negative');
      const positiveReviews = analysedReviews.filter((r) => r.analysis.sentiment === 'positive');

      const negativeSummaries = negativeReviews.map((r) => r.analysis.summary).slice(0, 40);
      const positiveSummaries = positiveReviews.map((r) => r.analysis.summary).slice(0, 40);

      try {
        const aiInsights = await generateInsightsFn({ negativeSummaries, positiveSummaries });
        const parsed = insightsSchema.safeParse(aiInsights);
        if (parsed.success) {
          return res.json({
            complaints: parsed.data.complaints,
            praises: parsed.data.praises,
            source: 'ai'
          });
        }
        throw new Error('Invalid AI response structure');
      } catch {
        // Fall back to top 3 topic counts
        const complaints = getTopTopics(negativeReviews);
        const praises = getTopTopics(positiveReviews);

        return res.json({
          complaints,
          praises,
          source: 'fallback'
        });
      }
    } catch (err) {
      next(err);
    }
  });

  return router;
}
