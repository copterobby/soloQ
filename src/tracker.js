const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { getMatchIdsByQueue, getMatchById } = require('./riot/match');
const { RiotRateLimitError } = require('./riot/client');
const { getLatestVersion } = require('./riot/ddragon');
const { getRankedSoloEntriesByPuuid } = require('./riot/league');
const { buildMatchDetailEmbed } = require('./discord/embeds');
const { withLock } = require('./util/lock');

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const CHECK_COUNT = 5;
const STREAK_CALLOUT_THRESHOLD = 3;

async function resolveGuildChannelsForUser(client, discordId, queueId) {
  const guilds = guildStore.getAllTrackedGuilds().filter((g) => g.trackedQueues.includes(queueId));
  const channels = [];

  for (const { guildId, channelId } of guilds) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) continue;

    const member = await guild.members.fetch(discordId).catch(() => null);
    if (!member) continue;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) continue;

    channels.push(channel);
  }

  return channels;
}

function buildHighlights(tracked, streak) {
  const highlights = [];
  if (tracked.pentaKills > 0) highlights.push('🌟 ¡PENTAKILL!');
  if (streak.count >= STREAK_CALLOUT_THRESHOLD) {
    const label = streak.type === 'W' ? 'victorias' : 'derrotas';
    highlights.push(`🔥 Racha de ${streak.count} ${label} seguidas`);
  }
  return highlights;
}

async function postMatchNotification(client, user, match, ddragonVersion, channels, highlights) {
  const rankedEntries = await getRankedSoloEntriesByPuuid(match.info.participants.map((p) => p.puuid));
  const embed = buildMatchDetailEmbed(match, user.puuid, ddragonVersion, rankedEntries);
  const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
  const resultText = tracked.win ? 'ha ganado' : 'ha perdido';
  const highlightsText = highlights.length > 0 ? `\n${highlights.join(' · ')}` : '';
  const content = `🎮 <@${user.discordId}> ${resultText} una partida jugando **${tracked.championName}**${highlightsText}`;

  for (const channel of channels) {
    try {
      await channel.send({ content, embeds: [embed] });
    } catch (err) {
      console.error(`Error enviando aviso al canal ${channel.id}:`, err);
    }
  }
}

async function checkUserQueue(client, user, queueId, ddragonVersion) {
  // Bloquea este (usuario, cola) mientras dura todo el ciclo de lectura-decisión-escritura,
  // para que el tracker automático y /syncgames nunca procesen las mismas partidas a la vez.
  await withLock(`${user.discordId}:${queueId}`, async () => {
    let matchIds;
    try {
      matchIds = await getMatchIdsByQueue(user.puuid, queueId, CHECK_COUNT);
    } catch (err) {
      if (err instanceof RiotRateLimitError) {
        console.warn(`Rate limited comprobando a ${user.gameName}#${user.tagLine} (cola ${queueId}); se reintenta luego.`);
      } else {
        console.error(`Error comprobando partidas de ${user.gameName}#${user.tagLine} (cola ${queueId}):`, err);
      }
      return;
    }

    if (matchIds.length === 0) return;

    const lastSeen = userStore.getLastSeenMatchId(user, queueId);

    if (!lastSeen) {
      // Primera vez que vemos a este usuario en esta cola: fijamos la base sin notificar su histórico.
      await userStore.setLastSeenMatchId(user.discordId, queueId, matchIds[0]);
      return;
    }

    const lastSeenIndex = matchIds.indexOf(lastSeen);
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

    const shouldNotify = user.notificationsEnabled !== false;
    const channels = shouldNotify ? await resolveGuildChannelsForUser(client, user.discordId, queueId) : [];

    const chronological = [...newMatchIds].reverse();
    for (const matchId of chronological) {
      try {
        const match = await getMatchById(matchId);
        const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
        // La racha se actualiza siempre, aunque el usuario tenga los avisos apagados o no
        // se resuelva ningún canal — refleja los resultados reales, no si se llegó a avisar.
        const streak = await userStore.updateStreak(user.discordId, queueId, tracked.win);

        if (channels.length > 0) {
          const highlights = buildHighlights(tracked, streak);
          await postMatchNotification(client, user, match, ddragonVersion, channels, highlights);
        }
      } catch (err) {
        console.error(`Error procesando la partida ${matchId} de ${user.gameName}#${user.tagLine}:`, err);
      }
    }

    await userStore.setLastSeenMatchId(user.discordId, queueId, matchIds[0]);
  });
}

async function checkUser(client, user, ddragonVersion, activeQueues) {
  for (const queueId of activeQueues) {
    await checkUserQueue(client, user, queueId, ddragonVersion);
  }
}

async function checkAllUsers(client) {
  const users = userStore.getAllUsers();
  if (users.length === 0) return;

  const guilds = guildStore.getAllTrackedGuilds();
  if (guilds.length === 0) return;

  const activeQueues = [...new Set(guilds.flatMap((g) => g.trackedQueues))];
  if (activeQueues.length === 0) return;

  let ddragonVersion = null;
  try {
    ddragonVersion = await getLatestVersion();
  } catch (err) {
    console.error('No se pudo obtener la versión de Data Dragon para el tracker:', err);
  }

  for (const user of users) {
    await checkUser(client, user, ddragonVersion, activeQueues);
  }
}

function startMatchTracker(client) {
  checkAllUsers(client).catch((err) => console.error('Error en la primera comprobación del tracker:', err));
  setInterval(() => {
    checkAllUsers(client).catch((err) => console.error('Error en el ciclo del tracker:', err));
  }, POLL_INTERVAL_MS);
}

module.exports = { startMatchTracker, buildHighlights, STREAK_CALLOUT_THRESHOLD };
