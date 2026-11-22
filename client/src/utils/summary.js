export function computeSummary(reviews = []) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return {
      total_analysed: 0,
      positive_pct: 0,
      neutral_pct: 0,
      negative_pct: 0,
      needs_reply_count: 0,
      skipped_empty: 0,
      duplicates: 0,
      analysis_failed: 0
    };
  }

  let total_analysed = 0;
  let positive_count = 0;
  let neutral_count = 0;
  let negative_count = 0;
  let needs_reply_count = 0;
  let skipped_empty = 0;
  let duplicates = 0;
  let analysis_failed = 0;

  for (const r of reviews) {
    if (r.analysis_status === 'ok') {
      total_analysed++;
      const sentiment = r.analysis?.sentiment;
      if (sentiment === 'positive') positive_count++;
      else if (sentiment === 'neutral') neutral_count++;
      else if (sentiment === 'negative') negative_count++;

      if (r.analysis?.needs_reply === true) {
        needs_reply_count++;
      }
    } else if (r.analysis_status === 'skipped_empty') {
      skipped_empty++;
    } else if (r.analysis_status === 'duplicate') {
      duplicates++;
    } else if (r.analysis_status === 'analysis_failed') {
      analysis_failed++;
    }
  }

  const positive_pct = total_analysed > 0 ? Math.round((positive_count / total_analysed) * 100) : 0;
  const neutral_pct = total_analysed > 0 ? Math.round((neutral_count / total_analysed) * 100) : 0;
  const negative_pct = total_analysed > 0 ? Math.round((negative_count / total_analysed) * 100) : 0;

  return {
    total_analysed,
    positive_pct,
    neutral_pct,
    negative_pct,
    needs_reply_count,
    skipped_empty,
    duplicates,
    analysis_failed
  };
}
