const config = require('../config');

class RiotNotFoundError extends Error {
  constructor(path) {
    super(`Riot API: recurso no encontrado (${path})`);
    this.name = 'RiotNotFoundError';
  }
}

class RiotRateLimitError extends Error {
  constructor(retryAfterSeconds) {
    super(`Riot API: rate limit alcanzado, reintenta en ${retryAfterSeconds}s`);
    this.name = 'RiotRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class RiotApiError extends Error {
  constructor(status, body) {
    super(`Riot API: error ${status}`);
    this.name = 'RiotApiError';
    this.status = status;
    this.body = body;
  }
}

const PLATFORM_BASE_URL = `https://${config.riotPlatformRegion}.api.riotgames.com`;
const CONTINENT_BASE_URL = `https://${config.riotContinentRegion}.api.riotgames.com`;

async function riotFetch(baseUrl, path, { query } = {}) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    headers: { 'X-Riot-Token': config.riotApiKey },
  });

  if (response.status === 200) {
    return response.json();
  }
  if (response.status === 404) {
    throw new RiotNotFoundError(path);
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 30;
    throw new RiotRateLimitError(retryAfter);
  }

  const body = await response.text().catch(() => '');
  throw new RiotApiError(response.status, body);
}

module.exports = {
  PLATFORM_BASE_URL,
  CONTINENT_BASE_URL,
  riotFetch,
  RiotNotFoundError,
  RiotRateLimitError,
  RiotApiError,
};
