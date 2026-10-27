/**
 * API-SPORTS HTTP Client with Robust Error Detection, Rate Limit Handling, and Retries.
 */

export class ApiSportsError extends Error {
  constructor(message, { statusCode = 500, errors = {}, endpoint = '', isRateLimit = false, isAuthError = false } = {}) {
    super(message);
    this.name = 'ApiSportsError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.endpoint = endpoint;
    this.isRateLimit = isRateLimit;
    this.isAuthError = isAuthError;
  }
}

export const getApiHeaders = (domain) => {
  const key = process.env.API_SPORTS_KEY;
  if (!key) {
    throw new ApiSportsError("API_SPORTS_KEY is not defined in environment variables", {
      statusCode: 500,
      isAuthError: true
    });
  }

  // Supply both x-apisports-key (direct) and x-rapidapi-key (RapidAPI) for maximum provider compatibility
  return {
    'x-apisports-key': key,
    'x-rapidapi-key': key,
    'x-rapidapi-host': domain,
    'Accept': 'application/json'
  };
};

/**
 * Checks if API-SPORTS payload contains errors even when HTTP status is 200.
 */
function extractProviderErrors(json) {
  if (!json || !json.errors) return null;

  if (Array.isArray(json.errors) && json.errors.length > 0) {
    return json.errors.join(', ');
  }

  if (typeof json.errors === 'object' && Object.keys(json.errors).length > 0) {
    const errorEntries = Object.entries(json.errors);
    if (errorEntries.length === 0) return null;
    return errorEntries.map(([key, val]) => `${key}: ${val}`).join('; ');
  }

  return null;
}

/**
 * Generic fetcher for API-SPORTS endpoints with timeout, provider error inspection, and bounded retries.
 * @param {string} domain - e.g., 'v3.football.api-sports.io'
 * @param {string} endpoint - e.g., '/fixtures?date=2023-10-25'
 * @param {object} options
 */
export const fetchApiSports = async (domain, endpoint, options = {}) => {
  const { timeoutMs = 10000, maxRetries = 2, backoffBaseMs = 500 } = options;
  const url = `https://${domain}${endpoint}`;
  const headers = getApiHeaders(domain);

  let attempt = 0;
  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle HTTP-level rate limits
      if (response.status === 429) {
        throw new ApiSportsError(`Provider rate limit reached (HTTP 429) at ${endpoint}`, {
          statusCode: 429,
          endpoint,
          isRateLimit: true
        });
      }

      if (response.status === 401 || response.status === 403) {
        throw new ApiSportsError(`Provider authentication failure (${response.status}) at ${endpoint}`, {
          statusCode: response.status,
          endpoint,
          isAuthError: true
        });
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new ApiSportsError(`Failed to fetch from ${domain}${endpoint}: ${response.status} ${response.statusText}. Details: ${errorText}`, {
          statusCode: response.status,
          endpoint
        });
      }

      const json = await response.json();

      // Inspect API-SPORTS specific error envelope (which often arrives with HTTP 200)
      const providerErrorStr = extractProviderErrors(json);
      if (providerErrorStr) {
        const isRateLimit = /rate limit|too many requests|requests per day/i.test(providerErrorStr);
        const isAuthError = /token|api key|unauthorized|subscription/i.test(providerErrorStr);
        
        throw new ApiSportsError(`API-SPORTS returned error for ${endpoint}: ${providerErrorStr}`, {
          statusCode: isRateLimit ? 429 : (isAuthError ? 403 : 502),
          errors: json.errors,
          endpoint,
          isRateLimit,
          isAuthError
        });
      }

      // Check for expected response payload structure
      if (!json || typeof json !== 'object' || !Array.isArray(json.response)) {
        throw new ApiSportsError(`Unexpected response format from API-SPORTS at ${endpoint}: response array missing`, {
          statusCode: 502,
          endpoint
        });
      }

      return json;
    } catch (err) {
      clearTimeout(timeoutId);

      const isAbort = err.name === 'AbortError';
      const isRetryable = isAbort || (err.statusCode && err.statusCode >= 500 && err.statusCode !== 502);

      // If non-retryable error (e.g., rate limit, auth error, provider logic error) or max retries reached:
      if (!isRetryable || attempt > maxRetries) {
        if (isAbort) {
          throw new ApiSportsError(`Request timed out after ${timeoutMs}ms for ${domain}${endpoint}`, {
            statusCode: 504,
            endpoint
          });
        }
        throw err;
      }

      // Exponential backoff before retry
      const delay = backoffBaseMs * Math.pow(2, attempt - 1);
      console.warn(`[ApiClient] Attempt ${attempt} failed for ${endpoint}: ${err.message}. Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
