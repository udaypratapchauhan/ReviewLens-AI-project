import React, { useState } from 'react';
import { generateReply } from '../api.js';

export default function ReplyButton({ reviewId }) {
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generateReply(reviewId);
      setReply(data.reply);
    } catch (err) {
      setError(err?.message || 'Failed to generate reply');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (reply) {
    return (
      <div className="reply-box">
        <div className="reply-content">"{reply}"</div>
        <button
          type="button"
          className="copy-reply-btn"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <span className="reply-loading">
        <span className="inline-spinner"></span> Generating reply...
      </span>
    );
  }

  return (
    <div className="reply-container">
      <button
        type="button"
        className="suggest-reply-btn"
        onClick={handleClick}
      >
        Suggest reply
      </button>
      {error && <div className="reply-error-inline">{error}</div>}
    </div>
  );
}
