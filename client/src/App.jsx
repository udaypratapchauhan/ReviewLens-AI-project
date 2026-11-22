import React, { useState } from 'react';
import { uploadReviews, fetchInsights } from './api.js';
import { computeSummary } from './utils/summary.js';
import SummaryCards from './components/SummaryCards.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import ReviewsTable from './components/ReviewsTable.jsx';
import './App.css';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(null);

  const processFile = async (file) => {
    if (!file) return;

    setLoading(true);
    setError(null);
    setInsights(null);
    setInsightsError(null);

    try {
      const uploadResult = await uploadReviews(file);
      setData(uploadResult);

      // Call POST /api/insights once after upload
      setInsightsLoading(true);
      try {
        const insightsResult = await fetchInsights();
        setInsights(insightsResult);
      } catch (err) {
        setInsightsError(err?.message || 'Failed to load insights');
      } finally {
        setInsightsLoading(false);
      }
    } catch (err) {
      setError(err?.message || 'Failed to upload and analyse reviews');
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!loading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (loading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const summary = data?.reviews ? computeSummary(data.reviews) : null;

  return (
    <div className="app-wrapper">
      {/* Hero Header with dark-blue to purple gradient */}
      <header className="hero-header">
        <div className="hero-content">
          <div className="hero-brand">
            <span className="hero-badge">AI Intelligence Suite</span>
            <h1 className="hero-title">ReviewLens</h1>
            <p className="hero-subtitle">
              Instantly transform messy customer feedback into actionable insights, sentiment analytics, and tailored replies.
            </p>
          </div>

          {/* Large rounded drag-and-drop style upload area */}
          <div
            className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${loading ? 'loading' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              onChange={handleFileInputChange}
              disabled={loading}
              style={{ display: 'none' }}
            />

            {loading ? (
              <div className="dropzone-loading">
                <div className="spinner"></div>
                <p className="loading-title">Analysing reviews, please wait...</p>
                <p className="loading-subtitle">
                  First upload can take a few minutes. Repeat uploads are instant thanks to the cache.
                </p>
              </div>
            ) : (
              <label htmlFor="csv-file-input" className="dropzone-label">
                <div className="upload-icon-wrapper">
                  <svg
                    className="upload-cloud-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="dropzone-text-group">
                  <p className="dropzone-primary-text">
                    Drag and drop your reviews CSV here, or <span className="browse-link">browse</span>
                  </p>
                  <p className="dropzone-secondary-text">Supports CSV files up to 1 MB</p>
                </div>
                <button
                  type="button"
                  className="browse-btn"
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                >
                  Select File
                </button>
              </label>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main">
        <div className="app-container">
          {error && (
            <div className="status-banner error-banner">
              <span className="banner-icon">⚠️</span>
              <p>
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {!data && !loading && (
            <div className="empty-state">
              <div className="empty-icon-circle">
                <svg
                  className="empty-icon-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="empty-title">Ready for Analysis</h3>
              <p className="empty-description">
                Upload your customer reviews CSV file above to generate automated sentiment breakdown, topic classification, top praises/complaints, and suggested replies.
              </p>
            </div>
          )}

          {data && summary && (
            <div className="dashboard-content">
              {summary.analysis_failed > 0 && (
                <div className="status-banner rate-limit-banner">
                  <span className="banner-icon">⏱️</span>
                  <p>
                    Some reviews hit the AI rate limit. Wait a minute and upload the same file again, finished reviews are cached.
                  </p>
                </div>
              )}

              <SummaryCards summary={summary} />

              <InsightsPanel
                insights={insights}
                error={insightsError}
                loading={insightsLoading}
              />

              <ReviewsTable reviews={data.reviews} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
