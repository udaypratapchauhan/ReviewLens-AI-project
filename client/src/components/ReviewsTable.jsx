import React, { useState, useMemo } from 'react';
import { filterReviews } from '../utils/filters.js';
import ReplyButton from './ReplyButton.jsx';

export default function ReviewsTable({ reviews = [] }) {
  const [productFilter, setProductFilter] = useState('All');
  const [sentimentFilter, setSentimentFilter] = useState('All');
  const [topicFilter, setTopicFilter] = useState('All');

  const products = useMemo(() => {
    const list = Array.from(new Set(reviews.map((r) => r.product).filter(Boolean)));
    list.sort();
    return ['All', ...list];
  }, [reviews]);

  const sentiments = ['All', 'positive', 'neutral', 'negative'];

  const topics = useMemo(() => {
    const list = Array.from(
      new Set(reviews.flatMap((r) => r.analysis?.topics || []).filter(Boolean))
    );
    list.sort();
    return ['All', ...list];
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    return filterReviews(reviews, {
      product: productFilter,
      sentiment: sentimentFilter,
      topic: topicFilter
    });
  }, [reviews, productFilter, sentimentFilter, topicFilter]);

  const getFlags = (r) => {
    const flags = [];
    if (r.status === 'duplicate' || r.analysis_status === 'duplicate') {
      flags.push('duplicate');
    }
    if (r.flags?.includes('rating_unknown') || r.rating === null || r.rating === undefined) {
      flags.push('rating unknown');
    }
    if (r.analysis_status === 'analysis_failed') {
      flags.push('analysis failed');
    }
    if (r.status === 'skipped_empty' || r.analysis_status === 'skipped_empty') {
      flags.push('skipped');
    }
    return flags;
  };

  return (
    <section className="table-section">
      <div className="table-header-controls">
        <h2 className="table-title">Reviews</h2>

        <div className="filter-group">
          <label className="filter-label">
            Product:
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="filter-select"
            >
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-label">
            Sentiment:
            <select
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="filter-select"
            >
              {sentiments.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-label">
            Topic:
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              className="filter-select"
            >
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="table-container">
        <table className="reviews-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Summary</th>
              <th>Sentiment</th>
              <th>Topics</th>
              <th>Needs reply</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan={8} className="no-results-cell">
                  No results
                </td>
              </tr>
            ) : (
              filteredReviews.map((r) => {
                const isSkippedEmpty =
                  r.status === 'skipped_empty' || r.analysis_status === 'skipped_empty';
                const summaryText = isSkippedEmpty
                  ? 'No text'
                  : r.analysis?.summary || '-';

                const sentiment = r.analysis?.sentiment;
                const topicsList = r.analysis?.topics || [];
                const needsReply = r.analysis?.needs_reply;
                const canSuggestReply = r.analysis_status === 'ok' && needsReply;
                const flags = getFlags(r);

                return (
                  <tr key={r.review_id || Math.random()}>
                    <td className="cell-id">{r.review_id || 'N/A'}</td>
                    <td className="cell-product">{r.product || 'N/A'}</td>
                    <td className="cell-rating">
                      {r.rating !== null && r.rating !== undefined ? r.rating : 'N/A'}
                    </td>
                    <td className="cell-summary">{summaryText}</td>
                    <td className="cell-sentiment">
                      {sentiment ? (
                        <span
                          className={`badge sentiment-badge sentiment-${sentiment.toLowerCase()}`}
                        >
                          {sentiment}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="cell-topics">
                      {topicsList.length > 0 ? (
                        <div className="topic-chips">
                          {topicsList.map((top) => (
                            <span key={top} className="topic-chip">
                              {top}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="cell-reply">
                      {needsReply ? (
                        <div className="needs-reply-wrapper">
                          <span className="badge badge-reply">Needs reply</span>
                          {canSuggestReply && (
                            <ReplyButton reviewId={r.review_id} />
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="cell-flags">
                      {flags.length > 0 ? (
                        <div className="flags-list">
                          {flags.map((f) => (
                            <span
                              key={f}
                              className={`flag-badge flag-${f.replace(/\s+/g, '-')}`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
