const BASE_URL = '/api';

export const fetchMatches = async () => {
  try {
    const response = await fetch(`${BASE_URL}/matches`);
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
    const response = await fetch(`${BASE_URL}/matches/${matchId}/commentary`);
    if (!response.ok) {
      throw new Error('Failed to fetch commentary');
    }
    const json = await response.json();
    return json.data;
  } catch (error) {
    console.error(`Error fetching commentary for match ${matchId}:`, error);
    throw error;
  }
};
