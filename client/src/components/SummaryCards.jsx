import React from 'react';

export default function SummaryCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="summary-section">
      <div className="main-cards-grid">
        <div className="card main-card total-card">
          <div className="card-header">
            <span className="card-icon">📊</span>
            <span className="card-label">Total Analysed</span>
          </div>
          <span className="card-value">{summary.total_analysed}</span>
        </div>

        <div className="card main-card positive-card">
          <div className="card-header">
            <span className="card-icon">😊</span>
            <span className="card-label">Positive</span>
          </div>
          <span className="card-value">{summary.positive_pct}%</span>
        </div>

        <div className="card main-card neutral-card">
          <div className="card-header">
            <span className="card-icon">😐</span>
            <span className="card-label">Neutral</span>
          </div>
          <span className="card-value">{summary.neutral_pct}%</span>
        </div>

        <div className="card main-card negative-card">
          <div className="card-header">
            <span className="card-icon">😞</span>
            <span className="card-label">Negative</span>
          </div>
          <span className="card-value">{summary.negative_pct}%</span>
        </div>

        <div className="card main-card reply-card">
          <div className="card-header">
            <span className="card-icon">💬</span>
            <span className="card-label">Needs Reply</span>
          </div>
          <span className="card-value">{summary.needs_reply_count}</span>
        </div>
      </div>

      <div className="small-cards-grid">
        <div className="card small-card skipped-card">
          <div className="small-header">
            <span className="card-icon">⏭️</span>
            <span className="small-label">Skipped Empty</span>
          </div>
          <span className="small-value">{summary.skipped_empty}</span>
        </div>

        <div className="card small-card duplicates-card">
          <div className="small-header">
            <span className="card-icon">📋</span>
            <span className="small-label">Duplicates</span>
          </div>
          <span className="small-value">{summary.duplicates}</span>
        </div>

        <div className="card small-card failed-card">
          <div className="small-header">
            <span className="card-icon">⚠️</span>
            <span className="small-label">Analysis Failed</span>
          </div>
          <span className="small-value">{summary.analysis_failed}</span>
        </div>
      </div>
    </div>
  );
}
