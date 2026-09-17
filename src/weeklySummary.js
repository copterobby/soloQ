const { EmbedBuilder } = require('discord.js');
const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { getMatchIdsInRange, getMatchById } = require('./riot/match');
const { getRankedSoloEntry } = require('./riot/league');
const { formatRankedEntry } = require('./discord/embeds');
const { getMostRecentWeekStart } = require('./util/weekSchedule');

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_MATCHES_PER_USER_PER_QUEUE = 30;

async function collectUserWeeklyStats(user, queueIds, startTimeSeconds) {
  let wins = 0;
  let losses = 0;

  for (const queueId of queueIds) {
    let matchIds = [];
    try {
      matchIds = await getMatchIdsInRange(user.puuid, queueId, {
        startTimeSeconds,
        count: MAX_MATCHES_PER_USER_PER_QUEUE,
      });
    } catch (err) {
      console.error(`Error obteniendo partidas semanales de ${user.gameName}#${user.tagLine} (cola ${queueId}):`, err);
      continue;
    }

    for (const matchId of matchIds) {
      try {
        const match = await getMatchById(matchId);
        const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
        if (tracked.win) wins += 1;
        else losses += 1;
      } catch (err) {
        console.error(`Error obteniendo detalle de partida ${matchId} para el resumen semanal:`, err);
      }
    }
  }

  let rankedEntry = null;
  try {
    rankedEntry = await getRankedSoloEntry(user.puuid);
  } catch (err) {
    console.error(`Error obteniendo el rango de ${user.gameName}#${user.tagLine} para el resumen semanal:`, err);
  }

  return { wins, losses, rankedEntry };
}

async function postWeeklySummaryForGuild(client, guild) {
  const channel = await client.channels.fetch(guild.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const { day, hour } = guildStore.getWeekSchedule(guild.guildId);
  const weekStart = getMostRecentWeekStart(day, hour);
  const startTimeSeconds = Math.floor(weekStart.getTime() / 1000);

  const users = userStore.getAllUsers(guild.guildId);
  const rows = [];

  for (const user of users) {
    const stats = await collectUserWeeklyStats(user, guild.trackedQueues, startTimeSeconds);
    if (stats.wins + stats.losses === 0) continue;

    rows.push({ user, ...stats });
  }

  await guildStore.setLastWeeklySummaryAt(guild.guildId, new Date().toISOString());

  if (rows.length === 0) return;

  rows.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));

  const lines = rows.map((r) => {
    const total = r.wins + r.losses;
    const winrate = Math.round((r.wins / total) * 100);
    return `<@${r.user.discordId}> — ${total} partidas (${r.wins}V - ${r.losses}D, ${winrate}%) · 🏆 ${formatRankedEntry(r.rankedEntry)}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📅 Resumen semanal')
    .setColor(0x5865f2)
    .setDescription(lines.join('\n'))
    .setFooter({ text: 'Desde el último inicio de semana configurado' });

  await channel.send({ embeds: [embed] });
}

function shouldPostNow(guild) {
  const now = new Date();
  const { day, hour } = guildStore.getWeekSchedule(guild.guildId);
  if (now.getDay() !== day || now.getHours() !== hour) return false;

  const lastPostedAt = guildStore.getLastWeeklySummaryAt(guild.guildId);
  if (!lastPostedAt) return true;

  const daysSinceLastPost = (Date.now() - new Date(lastPostedAt).getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceLastPost >= 6;
}

async function checkWeeklySummaries(client) {
  const guilds = guildStore.getAllTrackedGuilds();
  for (const guild of guilds) {
    if (!shouldPostNow(guild)) continue;
    try {
      await postWeeklySummaryForGuild(client, guild);
    } catch (err) {
      console.error(`Error publicando el resumen semanal del guild ${guild.guildId}:`, err);
    }
  }
}

function startWeeklySummary(client) {
  checkWeeklySummaries(client).catch((err) =>
    console.error('Error en la primera comprobación del resumen semanal:', err)
  );
  setInterval(() => {
    checkWeeklySummaries(client).catch((err) => console.error('Error en el ciclo del resumen semanal:', err));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startWeeklySummary };
