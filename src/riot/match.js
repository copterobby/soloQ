const { CONTINENT_BASE_URL, riotFetch } = require('./client');

const RANKED_SOLO_DUO_QUEUE_ID = 420;

async function getRankedSoloMatchIds(puuid, count = 5) {
  const path = `/lol/match/v5/matches/by-puuid/${puuid}/ids`;
  return riotFetch(CONTINENT_BASE_URL, path, {
    query: { queue: RANKED_SOLO_DUO_QUEUE_ID, start: 0, count },
  });
}

async function getMatchById(matchId) {
  const path = `/lol/match/v5/matches/${matchId}`;
  return riotFetch(CONTINENT_BASE_URL, path);
}

async function getRankedSoloMatches(puuid, count = 5) {
  const matchIds = await getRankedSoloMatchIds(puuid, count);
  const matches = [];
  for (const matchId of matchIds) {
    const match = await getMatchById(matchId);
    matches.push(match);
  }
  return matches;
}

module.exports = { getRankedSoloMatchIds, getMatchById, getRankedSoloMatches };
