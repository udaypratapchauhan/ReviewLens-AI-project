export async function uploadReviews(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || `Upload failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export async function fetchInsights() {
  const res = await fetch('/api/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || `Failed to fetch insights (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}

export async function generateReply(reviewId) {
  const res = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_id: reviewId })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error || `Failed to generate reply (${res.status})`;
    throw new Error(errorMsg);
  }

  return data;
}
