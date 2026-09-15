const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { getRankedSoloMatchIds, getMatchById } = require('./riot/match');
const { RiotRateLimitError } = require('./riot/client');
const { getLatestVersion } = require('./riot/ddragon');
const { getRankedSoloEntriesByPuuid } = require('./riot/league');
const { buildMatchDetailEmbed } = require('./discord/embeds');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_COUNT = 5;

async function postMatchNotification(client, user, match, ddragonVersion, channels) {
  const rankedEntries = await getRankedSoloEntriesByPuuid(match.info.participants.map((p) => p.puuid));
  const embed = buildMatchDetailEmbed(match, user.puuid, ddragonVersion, rankedEntries);
  const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
  const resultText = tracked.win ? 'ha ganado' : 'ha perdido';
  const content = `🎮 <@${user.discordId}> ${resultText} una partida jugando **${tracked.championName}**`;

  for (const { guildId, channelId } of channels) {
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      const member = await guild.members.fetch(user.discordId).catch(() => null);
      if (!member) continue;

      const channel = await client.channels.fetch(channelId).catch(() => null);
      if (!channel || !channel.isTextBased()) continue;

      await channel.send({ content, embeds: [embed] });
    } catch (err) {
      console.error(`Error enviando aviso al canal ${channelId} del guild ${guildId}:`, err);
    }
  }
}

async function checkUser(client, user, ddragonVersion) {
  let matchIds;
  try {
    matchIds = await getRankedSoloMatchIds(user.puuid, CHECK_COUNT);
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      console.warn(`Rate limited comprobando a ${user.gameName}#${user.tagLine}; se reintenta en el próximo ciclo.`);
    } else {
      console.error(`Error comprobando partidas de ${user.gameName}#${user.tagLine}:`, err);
    }
    return;
  }

  if (matchIds.length === 0) return;

  if (!user.lastSeenMatchId) {
    // Primera vez que vemos a este usuario: fijamos la base sin notificar su histórico.
    await userStore.setLastSeenMatchId(user.discordId, matchIds[0]);
    return;
  }

  const lastSeenIndex = matchIds.indexOf(user.lastSeenMatchId);
  let newMatchIds;
  if (lastSeenIndex === 0) {
    newMatchIds = [];
  } else if (lastSeenIndex === -1) {
    // Llevaba más de CHECK_COUNT partidas sin comprobarse; avisamos solo de la última para no hacer spam.
    newMatchIds = [matchIds[0]];
  } else {
    newMatchIds = matchIds.slice(0, lastSeenIndex);
  }

  if (newMatchIds.length === 0) return;

  const channels = guildStore.getAllTrackedChannels();
  if (channels.length === 0) {
    await userStore.setLastSeenMatchId(user.discordId, matchIds[0]);
    return;
  }

  const chronological = [...newMatchIds].reverse();
  for (const matchId of chronological) {
    try {
      const match = await getMatchById(matchId);
      await postMatchNotification(client, user, match, ddragonVersion, channels);
    } catch (err) {
      console.error(`Error obteniendo/publicando la partida ${matchId} de ${user.gameName}#${user.tagLine}:`, err);
    }
  }

  await userStore.setLastSeenMatchId(user.discordId, matchIds[0]);
}

async function checkAllUsers(client) {
  const users = userStore.getAllUsers();
  if (users.length === 0) return;

  let ddragonVersion = null;
  try {
    ddragonVersion = await getLatestVersion();
  } catch (err) {
    console.error('No se pudo obtener la versión de Data Dragon para el tracker:', err);
  }

  for (const user of users) {
    await checkUser(client, user, ddragonVersion);
  }
}

function startMatchTracker(client) {
  checkAllUsers(client).catch((err) => console.error('Error en la primera comprobación del tracker:', err));
  setInterval(() => {
    checkAllUsers(client).catch((err) => console.error('Error en el ciclo del tracker:', err));
  }, POLL_INTERVAL_MS);
}

module.exports = { startMatchTracker };
