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

// Límites reales de la dev key de Riot: 20 peticiones/1s y 100 peticiones/2min.
// Dejamos un pequeño margen para no rozar el límite exacto y acabar en el 429 de todos modos.
const SHORT_WINDOW_MS = 1000;
const SHORT_WINDOW_LIMIT = 18;
const LONG_WINDOW_MS = 2 * 60 * 1000;
const LONG_WINDOW_LIMIT = 95;
const RATE_LIMIT_POLL_MS = 50;

const requestTimestamps = [];

function pruneOldTimestamps(now) {
  while (requestTimestamps.length > 0 && now - requestTimestamps[0] > LONG_WINDOW_MS) {
    requestTimestamps.shift();
  }
}

// Reparte las llamadas salientes para no superar nunca los límites de Riot, en vez de
// dispararlas todas y reaccionar a un 429 (que puede imponer una espera de hasta 2 minutos).
async function acquireRateLimitSlot() {
  for (;;) {
    const now = Date.now();
    pruneOldTimestamps(now);
    const countInShortWindow = requestTimestamps.filter((t) => now - t < SHORT_WINDOW_MS).length;

    if (countInShortWindow < SHORT_WINDOW_LIMIT && requestTimestamps.length < LONG_WINDOW_LIMIT) {
      requestTimestamps.push(now);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_POLL_MS));
  }
}

async function riotFetch(baseUrl, path, { query } = {}) {
  const url = new URL(path, baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }

  await acquireRateLimitSlot();

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
