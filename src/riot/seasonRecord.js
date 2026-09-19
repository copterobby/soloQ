const { getMatchIdsInRange, getMatchesByIds, QUEUE_IDS } = require('./match');
const { isRemake } = require('../util/remake');

const PAGE_SIZE = 100; // máximo que acepta la API de Riot por página
const MAX_MATCHES = 300; // tope de seguridad total; si se supera, se marca truncated

async function getSeasonMatchIds(puuid, startTimeSeconds, queueId = QUEUE_IDS.SOLO) {
  const matchIds = [];
  let start = 0;
  let truncated = false;

  for (;;) {
    const page = await getMatchIdsInRange(puuid, queueId, { startTimeSeconds, start, count: PAGE_SIZE });
    matchIds.push(...page);

    if (page.length < PAGE_SIZE) break; // última página
    if (matchIds.length >= MAX_MATCHES) {
      truncated = true;
      break;
    }
    start += PAGE_SIZE;
  }

  return { matchIds: matchIds.slice(0, MAX_MATCHES), truncated };
}

async function getSeasonMatches(puuid, startTimeSeconds, queueId = QUEUE_IDS.SOLO) {
  const { matchIds, truncated } = await getSeasonMatchIds(puuid, startTimeSeconds, queueId);
  const allMatches = await getMatchesByIds(matchIds);
  // Los remakes no cuentan como victoria ni derrota (ni para el récord ni para las medias de 1vs1).
  const matches = allMatches.filter((match) => !isRemake(match));
  return { matches, truncated };
}

function summarizeRecord(matches, puuid) {
  let wins = 0;
  let losses = 0;
  for (const match of matches) {
    const participant = match.info.participants.find((p) => p.puuid === puuid);
    if (participant.win) wins += 1;
    else losses += 1;
  }
  return { wins, losses, games: wins + losses };
}

async function getSeasonRecord(puuid, startTimeSeconds, queueId = QUEUE_IDS.SOLO) {
  const { matches, truncated } = await getSeasonMatches(puuid, startTimeSeconds, queueId);
  return { ...summarizeRecord(matches, puuid), truncated };
}

function formatSeasonStart(startSeconds) {
  const date = new Date(startSeconds * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

module.exports = { getSeasonMatches, summarizeRecord, getSeasonRecord, formatSeasonStart };
