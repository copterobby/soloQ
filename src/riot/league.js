const { PLATFORM_BASE_URL, riotFetch } = require('./client');

async function getRankedSoloEntry(puuid) {
  const entries = await riotFetch(PLATFORM_BASE_URL, `/lol/league/v4/entries/by-puuid/${puuid}`);
  return entries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5') || null;
}

// Bounded concurrency instead of one-at-a-time: this runs on the tracker's hot polling path,
// so 10 sequential round-trips per match notification is latency worth avoiding.
async function getRankedSoloEntriesByPuuid(puuids, concurrency = 5) {
  const entries = new Map();
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= puuids.length) return;
      const puuid = puuids[current];
      try {
        entries.set(puuid, await getRankedSoloEntry(puuid));
      } catch (err) {
        console.error(`Error obteniendo el rango de ${puuid}:`, err);
        entries.set(puuid, null);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, puuids.length) }, worker);
  await Promise.all(workers);
  return entries;
}

module.exports = { getRankedSoloEntry, getRankedSoloEntriesByPuuid };
