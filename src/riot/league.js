const { PLATFORM_BASE_URL, riotFetch } = require('./client');

async function getRankedSoloEntry(puuid) {
  const entries = await riotFetch(PLATFORM_BASE_URL, `/lol/league/v4/entries/by-puuid/${puuid}`);
  return entries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5') || null;
}

async function getRankedSoloEntriesByPuuid(puuids) {
  const entries = new Map();
  for (const puuid of puuids) {
    try {
      entries.set(puuid, await getRankedSoloEntry(puuid));
    } catch (err) {
      console.error(`Error obteniendo el rango de ${puuid}:`, err);
      entries.set(puuid, null);
    }
  }
  return entries;
}

module.exports = { getRankedSoloEntry, getRankedSoloEntriesByPuuid };
