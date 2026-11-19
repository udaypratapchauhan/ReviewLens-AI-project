import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseAndCleanReviews, hashText } from './cleaning.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const realCsvContent = fs.readFileSync(path.resolve(__dirname, '../../data/reviews.csv'), 'utf8');

describe('parseAndCleanReviews', () => {
  // 1. empty text -> skipped_empty (R005)
  it('marks empty review text as skipped_empty (R005)', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r005 = reviews.find((r) => r.review_id === 'R005');

    expect(r005).toBeDefined();
    expect(r005.text).toBe('');
    expect(r005.status).toBe('skipped_empty');
  });

  // 2. missing rating (R010) and "five" rating (R022) -> rating null + rating_unknown
  it('sets rating to null and flags rating_unknown for missing or non-integer ratings (R010, R022)', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r010 = reviews.find((r) => r.review_id === 'R010');
    const r022 = reviews.find((r) => r.review_id === 'R022');

    expect(r010.rating).toBeNull();
    expect(r010.flags).toContain('rating_unknown');
    expect(r010.status).toBe('to_analyse');

    expect(r022.rating).toBeNull();
    expect(r022.flags).toContain('rating_unknown');
    expect(r022.status).toBe('to_analyse');
  });

  // 3. R012 and R015: R012 to_analyse, R015 duplicate with duplicate_of R012
  it('marks R012 as to_analyse and duplicate R015 with duplicate_of R012', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r012 = reviews.find((r) => r.review_id === 'R012');
    const r015 = reviews.find((r) => r.review_id === 'R015');

    expect(r012.status).toBe('to_analyse');
    expect(r012.duplicate_of).toBeNull();

    expect(r015.status).toBe('duplicate');
    expect(r015.duplicate_of).toBe('R012');
    expect(r015.text_hash).toBe(r012.text_hash);
  });

  // 4. HTML stripping (R024 has <b>)
  it('strips HTML tags from review text (R024)', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r024 = reviews.find((r) => r.review_id === 'R024');

    expect(r024.text).not.toContain('<b>');
    expect(r024.text).not.toContain('</b>');
    expect(r024.text).toBe('Love it! Keeps my desk clean, and the bamboo smells nice.');
  });

  // 5. multi-line quoted text collapses to one line (R001)
  it('collapses multi-line quoted text into a single line (R001)', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r001 = reviews.find((r) => r.review_id === 'R001');

    expect(r001.text).not.toContain('\n');
    expect(r001.text).not.toContain('\r');
    expect(r001.text).toBe(
      'Super soft fabric, colours did not fade after 3 washes. Worth the price.'
    );
  });

  // 6. Devanagari text is preserved (R016)
  it('preserves non-Latin Devanagari text (R016)', () => {
    const { reviews } = parseAndCleanReviews(realCsvContent);
    const r016 = reviews.find((r) => r.review_id === 'R016');

    expect(r016.text).toBe('आवाज़ अच्छी है लेकिन बैटरी जल्दी खत्म हो जाती है।');
  });

  // 7. a malformed row does not throw
  it('does not throw when encountering a malformed row and flags it', () => {
    const malformedCsv = `review_id,product,rating,date,review_text
R001,Product A,5,2026-10-01,Valid review
R002,Malformed row without enough columns
R003,Product C,4,2026-10-02,Another valid review`;

    expect(() => {
      const { reviews, report } = parseAndCleanReviews(malformedCsv);
      expect(report.malformed).toBe(1);
      expect(report.to_analyse).toBe(2);
      expect(reviews[1].status).toBe('malformed');
      expect(reviews[1].flags).toContain('malformed');
    }).not.toThrow();
  });

  // 8. the real /data/reviews.csv gives: total 30, to_analyse 28, skipped_empty 1, duplicates 1, malformed 0, rating_unknown 2
  it('produces exact expected report metrics for the real /data/reviews.csv', () => {
    const { report } = parseAndCleanReviews(realCsvContent);

    expect(report).toEqual({
      total: 30,
      to_analyse: 28,
      skipped_empty: 1,
      duplicates: 1,
      malformed: 0,
      rating_unknown: 2
    });
  });
});
