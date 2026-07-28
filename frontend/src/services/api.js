const isProd = import.meta.env.PROD;
const BASE_URL = import.meta.env.VITE_API_URL || (isProd ? 'https://sportz-xh8v.onrender.com' : 'http://localhost:8000');

export const fetchMatches = async (sport = 'football') => {
  try {
    const url = sport ? `${BASE_URL}/matches?sport=${encodeURIComponent(sport)}` : `${BASE_URL}/matches`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch matches');
    }

    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error('Error fetching matches:', error);
    throw error;
  }
};

export const fetchCommentary = async (matchId) => {
  try {
    const response = await fetch(
        `${BASE_URL}/matches/${matchId}/commentary`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch commentary');
    }

    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error(
        `Error fetching commentary for match ${matchId}:`,
        error
    );
    throw error;
  }
};