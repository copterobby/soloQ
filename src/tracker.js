const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { getMatchIdsByQueue, getMatchById } = require('./riot/match');
const { RiotRateLimitError } = require('./riot/client');
const { getLatestVersion } = require('./riot/ddragon');
const { getRankedSoloEntriesByPuuid } = require('./riot/league');
const { buildMatchDetailEmbed } = require('./discord/embeds');
const { withLock } = require('./util/lock');
const botStatus = require('./botStatus');
const { notifyOwner } = require('./util/ownerAlert');
const { isRemake } = require('./util/remake');

const TRACKER_KEY = 'lol';

const POLL_INTERVAL_MS = 2 * 60 * 1000;
const CHECK_COUNT = 5;
const STREAK_CALLOUT_THRESHOLD = 3;

async function resolveGuildChannel(client, guildId, queueId) {
  const trackedQueues = guildStore.getTrackedQueues(guildId);
  if (!trackedQueues.includes(queueId)) return null;

  const channelId = guildStore.getTrackedChannelId(guildId);
  if (!channelId) return null;

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return null;

  return channel;
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

// Texto del aviso, compartido con /syncgames para que ambos digan lo mismo. Un remake no es
// ni victoria ni derrota, así que no lleva "ha ganado/ha perdido" ni destacados de racha.
function buildNotificationContent(discordId, tracked, remake, highlights) {
  if (remake) {
    return `🔄 <@${discordId}> ha tenido un remake jugando **${tracked.championName}** (no cuenta como victoria ni derrota)`;
  }
  const resultText = tracked.win ? 'ha ganado' : 'ha perdido';
  const highlightsText = highlights.length > 0 ? `\n${highlights.join(' · ')}` : '';
  return `🎮 <@${discordId}> ${resultText} una partida jugando **${tracked.championName}**${highlightsText}`;
}

async function postMatchNotification(client, user, match, ddragonVersion, channels, highlights) {
  const rankedEntries = await getRankedSoloEntriesByPuuid(match.info.participants.map((p) => p.puuid));
  const embed = buildMatchDetailEmbed(match, user.puuid, ddragonVersion, rankedEntries);
  const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
  const content = buildNotificationContent(user.discordId, tracked, isRemake(match), highlights);

  for (const channel of channels) {
    try {
      await channel.send({ content, embeds: [embed] });
    } catch (err) {
      console.error(`Error enviando aviso al canal ${channel.id}:`, err);
    }
  }
}

async function checkUserQueue(client, guildId, user, queueId, ddragonVersion) {
  // Bloquea este (guild, usuario, cola) mientras dura todo el ciclo de lectura-decisión-escritura,
  // para que el tracker automático y /syncgames nunca procesen las mismas partidas a la vez.
  await withLock(`${guildId}:${user.discordId}:${queueId}`, async () => {
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
      await userStore.setLastSeenMatchId(guildId, user.discordId, queueId, matchIds[0]);
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
    const channel = shouldNotify ? await resolveGuildChannel(client, guildId, queueId) : null;
    const channels = channel ? [channel] : [];

    const chronological = [...newMatchIds].reverse();
    for (const matchId of chronological) {
      try {
        const match = await getMatchById(matchId);
        const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
        const remake = isRemake(match);
        // La racha se actualiza siempre, aunque el usuario tenga los avisos apagados o no
        // se resuelva ningún canal — refleja los resultados reales, no si se llegó a avisar.
        // Un remake no cuenta como victoria ni derrota, así que no toca la racha.
        const streak = remake ? null : await userStore.updateStreak(guildId, user.discordId, queueId, tracked.win);

        if (channels.length > 0) {
          const highlights = remake ? [] : buildHighlights(tracked, streak);
          await postMatchNotification(client, user, match, ddragonVersion, channels, highlights);
        }
      } catch (err) {
        console.error(`Error procesando la partida ${matchId} de ${user.gameName}#${user.tagLine}:`, err);
      }
    }

    await userStore.setLastSeenMatchId(guildId, user.discordId, queueId, matchIds[0]);
  });
}

async function checkUser(client, guildId, user, ddragonVersion, activeQueues) {
  for (const queueId of activeQueues) {
    await checkUserQueue(client, guildId, user, queueId, ddragonVersion);
  }
}

async function checkAllUsers(client) {
  try {
    const guilds = guildStore.getAllTrackedGuilds();
    if (guilds.length > 0) {
      let ddragonVersion = null;
      try {
        ddragonVersion = await getLatestVersion();
      } catch (err) {
        console.error('No se pudo obtener la versión de Data Dragon para el tracker:', err);
      }

      for (const guild of guilds) {
        const users = userStore.getAllUsers(guild.guildId);
        if (users.length === 0) continue;

        for (const user of users) {
          await checkUser(client, guild.guildId, user, ddragonVersion, guild.trackedQueues);
        }
      }
    }

    botStatus.recordCycle(TRACKER_KEY, { ok: true });
  } catch (err) {
    const shouldAlert = botStatus.recordCycle(TRACKER_KEY, { ok: false, error: err });
    if (shouldAlert) {
      await notifyOwner(
        client,
        `⚠️ El tracker de League lleva ${botStatus.FAILURE_ALERT_THRESHOLD} ciclos seguidos fallando. Último error: ${err.message}`
      );
    }
    throw err;
  }
}

function startMatchTracker(client) {
  checkAllUsers(client).catch((err) => console.error('Error en la primera comprobación del tracker:', err));
  setInterval(() => {
    checkAllUsers(client).catch((err) => console.error('Error en el ciclo del tracker:', err));
  }, POLL_INTERVAL_MS);
}

module.exports = { startMatchTracker, buildHighlights, buildNotificationContent, STREAK_CALLOUT_THRESHOLD };
