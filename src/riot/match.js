const { CONTINENT_BASE_URL, riotFetch } = require('./client');

const QUEUE_IDS = { SOLO: 420, FLEX: 440 };

async function getMatchIdsByQueue(puuid, queueId, count = 5) {
  const path = `/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  return riotFetch(CONTINENT_BASE_URL, path, {
    query: { queue: queueId, start: 0, count },
  });
}

// startTimeSeconds/endTimeSeconds are epoch seconds, per the Match-V5 API.
async function getMatchIdsInRange(puuid, queueId, { startTimeSeconds, endTimeSeconds, start = 0, count = 100 } = {}) {
  const path = `/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  const query = { queue: queueId, start, count };
  if (startTimeSeconds) query.startTime = startTimeSeconds;
  if (endTimeSeconds) query.endTime = endTimeSeconds;
  return riotFetch(CONTINENT_BASE_URL, path, { query });
}

async function getMatchById(matchId) {
  const path = `/lol/match/v5/matches/${matchId}`;
  return riotFetch(CONTINENT_BASE_URL, path);
}

async function getRankedSoloMatchIds(puuid, count = 5) {
  return getMatchIdsByQueue(puuid, QUEUE_IDS.SOLO, count);
}

// Fetches match details with a bounded number of requests in flight at once, instead of
// one-at-a-time, to keep this fast without bursting past Riot's per-second rate limit.
async function getMatchesByIds(matchIds, concurrency = 5) {
  const results = new Array(matchIds.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= matchIds.length) return;
      results[current] = await getMatchById(matchIds[current]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, matchIds.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function getRankedSoloMatches(puuid, count = 5) {
  const matchIds = await getRankedSoloMatchIds(puuid, count);
  return getMatchesByIds(matchIds);
}

module.exports = {
  QUEUE_IDS,
  getMatchIdsByQueue,
  getMatchIdsInRange,
  getMatchById,
  getMatchesByIds,
  getRankedSoloMatchIds,
  getRankedSoloMatches,
};
