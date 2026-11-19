import crypto from 'crypto';
import { parse } from 'csv-parse/sync';

export function hashText(text) {
  return crypto.createHash('sha256').update(String(text ?? '').toLowerCase()).digest('hex');
}

function cleanText(rawText) {
  if (!rawText) return '';
  return String(rawText)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRating(rawRating) {
  if (rawRating === null || rawRating === undefined || rawRating === '') {
    return null;
  }
  const str = String(rawRating).trim();
  return /^[1-5]$/.test(str) ? parseInt(str, 10) : null;
}

export function parseAndCleanReviews(csvText) {
  if (!csvText || typeof csvText !== 'string' || !csvText.trim()) {
    return {
      reviews: [],
      report: {
        total: 0,
        to_analyse: 0,
        skipped_empty: 0,
        duplicates: 0,
        malformed: 0,
        rating_unknown: 0
      }
    };
  }

  let rawRows = [];
  try {
    rawRows = parse(csvText, {
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      on_record: (record, context) => ({
        record,
        isMalformed: Boolean(context.error) || !record.review_id || record.review_text === undefined
      })
    });
  } catch {
    return {
      reviews: [{
        review_id: null,
        product: null,
        rating: null,
        date: null,
        text: '',
        status: 'malformed',
        flags: ['malformed'],
        text_hash: hashText(''),
        duplicate_of: null
      }],
      report: {
        total: 1,
        to_analyse: 0,
        skipped_empty: 0,
        duplicates: 0,
        malformed: 1,
        rating_unknown: 0
      }
    };
  }

  const seenHashes = new Map();
  const reviews = [];
  const report = {
    total: rawRows.length,
    to_analyse: 0,
    skipped_empty: 0,
    duplicates: 0,
    malformed: 0,
    rating_unknown: 0
  };

  for (const item of rawRows) {
    const { record, isMalformed } = item;
    const flags = [];

    if (isMalformed) {
      report.malformed++;
      flags.push('malformed');
      const text = record.review_text !== undefined ? cleanText(record.review_text) : '';
      reviews.push({
        review_id: record.review_id ? String(record.review_id).trim() : null,
        product: record.product ? String(record.product).trim() : null,
        rating: null,
        date: record.date ? String(record.date).trim() : null,
        text,
        status: 'malformed',
        flags,
        text_hash: hashText(text),
        duplicate_of: null
      });
      continue;
    }

    const review_id = String(record.review_id).trim();
    const product = record.product !== undefined ? String(record.product).trim() : '';
    const date = record.date !== undefined ? String(record.date).trim() : '';
    const rating = parseRating(record.rating);

    if (rating === null) {
      flags.push('rating_unknown');
      report.rating_unknown++;
    }

    const text = cleanText(record.review_text);
    const text_hash = hashText(text);

    let status;
    let duplicate_of = null;

    if (text.length === 0) {
      status = 'skipped_empty';
      report.skipped_empty++;
    } else if (seenHashes.has(text_hash)) {
      status = 'duplicate';
      duplicate_of = seenHashes.get(text_hash);
      report.duplicates++;
    } else {
      status = 'to_analyse';
      seenHashes.set(text_hash, review_id);
      report.to_analyse++;
    }

    reviews.push({
      review_id,
      product,
      rating,
      date,
      text,
      status,
      flags,
      text_hash,
      duplicate_of
    });
  }

  return { reviews, report };
}
