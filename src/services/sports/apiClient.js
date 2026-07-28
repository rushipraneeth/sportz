export const getApiHeaders = () => {
    const key = process.env.API_SPORTS_KEY;
    if (!key) {
        throw new Error("API_SPORTS_KEY is not defined in environment variables");
    }
    return {
        'x-rapidapi-key': key
    };
};

/**
 * Generic fetcher for API-SPORTS endpoints
 * @param {string} domain - e.g., 'v3.football.api-sports.io', 'v1.basketball.api-sports.io'
 * @param {string} endpoint - e.g., '/fixtures?date=2023-10-25'
 */
export const fetchApiSports = async (domain, endpoint) => {
    const url = `https://${domain}${endpoint}`;
    
    const headers = {
        ...getApiHeaders(),
        'x-rapidapi-host': domain
    };

    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`Failed to fetch from ${url}: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json;
};
