const { CONTINENT_BASE_URL, riotFetch } = require('./client');

async function getAccountByRiotId(gameName, tagLine) {
  const path = `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  const data = await riotFetch(CONTINENT_BASE_URL, path);
  return { puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine };
}

module.exports = { getAccountByRiotId };
