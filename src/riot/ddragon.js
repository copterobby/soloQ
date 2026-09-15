const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json';
const VERSION_TTL_MS = 60 * 60 * 1000;
const FALLBACK_VERSION = '14.19.1';

let cachedVersion = null;
let cachedAt = 0;

async function getLatestVersion() {
  const now = Date.now();
  if (cachedVersion && now - cachedAt < VERSION_TTL_MS) {
    return cachedVersion;
  }
  try {
    const response = await fetch(VERSIONS_URL);
    const versions = await response.json();
    cachedVersion = versions[0];
    cachedAt = now;
    return cachedVersion;
  } catch (err) {
    return cachedVersion || FALLBACK_VERSION;
  }
}

function championIconUrl(version, championName) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

function profileIconUrl(version, profileIconId) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/profileicon/${profileIconId}.png`;
}

module.exports = { getLatestVersion, championIconUrl, profileIconUrl };
