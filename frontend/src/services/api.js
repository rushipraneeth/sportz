const isProd = import.meta.env.PROD;
const BASE_URL = import.meta.env.VITE_API_URL || (isProd ? 'https://sportz-xh8v.onrender.com' : 'http://localhost:8000');

export const fetchMatches = async (sport = 'football', refresh = false) => {
  try {
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (refresh) params.set('refresh', 'true');

    const url = `${BASE_URL}/matches?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      const message = errorJson?.error || `Failed to fetch matches (HTTP ${response.status})`;
      const error = new Error(message);
      error.statusCode = response.status;
      error.isRateLimit = response.status === 429 || errorJson?.isRateLimit;
      error.details = errorJson?.details;
      throw error;
    }

    const json = await response.json();
    return {
      matches: json.data || [],
      meta: json.meta || {}
    };
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
};

export const fetchCommentary = async (matchId) => {
  try {
    const response = await fetch(`${BASE_URL}/matches/${matchId}/commentary`);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      const message = errorJson?.error || `Failed to fetch commentary (HTTP ${response.status})`;
      throw new Error(message);
    }

    const json = await response.json();
    return json.data || [];
  } catch (error) {
    console.error(`Error fetching commentary for match ${matchId}:`, error);
    throw error;
  }
};