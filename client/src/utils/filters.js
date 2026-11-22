/**
 * Pure function to filter an array of reviews by product, sentiment, and topic.
 *
 * @param {Array} reviews
 * @param {Object} filters
 * @param {string} [filters.product='All']
 * @param {string} [filters.sentiment='All']
 * @param {string} [filters.topic='All']
 * @returns {Array} Filtered reviews
 */
export function filterReviews(reviews, { product = 'All', sentiment = 'All', topic = 'All' } = {}) {
  if (!Array.isArray(reviews)) {
    return [];
  }

  return reviews.filter((review) => {
    if (product && product !== 'All') {
      if (review.product !== product) {
        return false;
      }
    }

    if (sentiment && sentiment !== 'All') {
      const s = review.analysis?.sentiment;
      if (!s || s.toLowerCase() !== sentiment.toLowerCase()) {
        return false;
      }
    }

    if (topic && topic !== 'All') {
      const topics = review.analysis?.topics;
      if (!Array.isArray(topics) || !topics.includes(topic)) {
        return false;
      }
    }

    return true;
  });
}
