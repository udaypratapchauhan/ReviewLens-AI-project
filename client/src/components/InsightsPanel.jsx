import React from 'react';

export default function InsightsPanel({ insights, error, loading }) {
  if (loading) {
    return (
      <div className="insights-section">
        <div className="insights-status">
          <div className="mini-spinner"></div>
          <span>Discovering key complaints and praises with AI...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-section">
        <div className="insights-status insights-error">
          <span>Insights currently unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  const complaints = insights.complaints || [];
  const praises = insights.praises || [];

  return (
    <div className="insights-section">
      <div className="insights-grid">
        <div className="card insight-panel complaints-panel">
          <div className="insight-panel-header">
            <span className="insight-panel-icon">⚠️</span>
            <h3 className="insight-panel-title">Top 3 Complaints</h3>
          </div>
          {complaints.length === 0 ? (
            <p className="insight-empty">No complaints detected</p>
          ) : (
            <ul className="insight-list">
              {complaints.map((item, index) => (
                <li key={index} className="insight-item">
                  <span className="insight-title">{item.title}</span>
                  <span className="insight-count complaint-count">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card insight-panel praises-panel">
          <div className="insight-panel-header">
            <span className="insight-panel-icon">🌟</span>
            <h3 className="insight-panel-title">Top 3 Praises</h3>
          </div>
          {praises.length === 0 ? (
            <p className="insight-empty">No praises detected</p>
          ) : (
            <ul className="insight-list">
              {praises.map((item, index) => (
                <li key={index} className="insight-item">
                  <span className="insight-title">{item.title}</span>
                  <span className="insight-count praise-count">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
