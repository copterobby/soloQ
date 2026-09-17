const { EmbedBuilder } = require('discord.js');
const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { getMatchIdsInRange, getMatchById } = require('./riot/match');
const { getRankedSoloEntry } = require('./riot/league');
const { formatRankedEntry } = require('./discord/embeds');
const botStatus = require('./botStatus');
const { notifyOwner } = require('./util/ownerAlert');

// Hermano de weeklySummary.js con el mismo patrón, pero de cadencia mensual y coronando un
// MVP en vez de solo listar partidas.
const TRACKER_KEY = 'monthlySummary';
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MAX_MATCHES_PER_USER_PER_QUEUE = 100;
const MIN_GAMES_FOR_MVP = 3;

function getPreviousMonthRange() {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
  return {
    startTimeSeconds: Math.floor(startOfPrevMonth.getTime() / 1000),
    endTimeSeconds: Math.floor(startOfThisMonth.getTime() / 1000),
    label: startOfPrevMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
  };
}

async function collectUserMonthlyStats(user, queueIds, startTimeSeconds, endTimeSeconds) {
  let wins = 0;
  let losses = 0;

  for (const queueId of queueIds) {
    let matchIds = [];
    try {
      matchIds = await getMatchIdsInRange(user.puuid, queueId, {
        startTimeSeconds,
        endTimeSeconds,
        count: MAX_MATCHES_PER_USER_PER_QUEUE,
      });
    } catch (err) {
      console.error(`Error obteniendo partidas mensuales de ${user.gameName}#${user.tagLine} (cola ${queueId}):`, err);
      continue;
    }

    for (const matchId of matchIds) {
      try {
        const match = await getMatchById(matchId);
        const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
        if (tracked.win) wins += 1;
        else losses += 1;
      } catch (err) {
        console.error(`Error obteniendo detalle de partida ${matchId} para el resumen mensual:`, err);
      }
    }
  }

  let rankedEntry = null;
  try {
    rankedEntry = await getRankedSoloEntry(user.puuid);
  } catch (err) {
    console.error(`Error obteniendo el rango de ${user.gameName}#${user.tagLine} para el resumen mensual:`, err);
  }

  return { wins, losses, rankedEntry };
}

// MVP = más victorias (con un mínimo de partidas para no dárselo a quien jugó una sola vez
// y ganó); empate en victorias se rompe por winrate.
function pickMVP(rows) {
  const eligible = rows.filter((r) => r.wins + r.losses >= MIN_GAMES_FOR_MVP);
  const pool = eligible.length > 0 ? eligible : rows;

  return pool.reduce((best, r) => {
    if (!best) return r;
    if (r.wins !== best.wins) return r.wins > best.wins ? r : best;
    const rWinrate = r.wins / (r.wins + r.losses);
    const bestWinrate = best.wins / (best.wins + best.losses);
    return rWinrate > bestWinrate ? r : best;
  }, null);
}

async function postMonthlySummaryForGuild(client, guild) {
  const channel = await client.channels.fetch(guild.channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const { startTimeSeconds, endTimeSeconds, label } = getPreviousMonthRange();
  const users = userStore.getAllUsers(guild.guildId);
  const rows = [];

  for (const user of users) {
    const stats = await collectUserMonthlyStats(user, guild.trackedQueues, startTimeSeconds, endTimeSeconds);
    if (stats.wins + stats.losses === 0) continue;
    rows.push({ user, ...stats });
  }

  await guildStore.setLastMonthlySummaryAt(guild.guildId, new Date().toISOString());

  if (rows.length === 0) return;

  rows.sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
  const mvp = pickMVP(rows);

  const lines = rows.map((r) => {
    const total = r.wins + r.losses;
    const winrate = Math.round((r.wins / total) * 100);
    const mvpMark = r === mvp ? ' 👑' : '';
    return `<@${r.user.discordId}> — ${total} partidas (${r.wins}V - ${r.losses}D, ${winrate}%) · 🏆 ${formatRankedEntry(r.rankedEntry)}${mvpMark}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🏅 Resumen de ${label}`)
    .setColor(0xf1c40f)
    .setDescription(
      `👑 MVP del mes: <@${mvp.user.discordId}> con **${mvp.wins}V - ${mvp.losses}D**\n\n${lines.join('\n')}`
    );

  await channel.send({ embeds: [embed] });
}

function shouldPostNow(guild) {
  const now = new Date();
  if (now.getDate() !== 1) return false;

  const { hour } = guildStore.getWeekSchedule(guild.guildId);
  if (now.getHours() !== hour) return false;

  const lastPostedAt = guildStore.getLastMonthlySummaryAt(guild.guildId);
  if (!lastPostedAt) return true;

  const daysSinceLastPost = (Date.now() - new Date(lastPostedAt).getTime()) / (24 * 60 * 60 * 1000);
  return daysSinceLastPost >= 27; // margen para no volver a publicar el mismo día 1
}

async function checkMonthlySummaries(client) {
  try {
    const guilds = guildStore.getAllTrackedGuilds();
    for (const guild of guilds) {
      if (!shouldPostNow(guild)) continue;
      try {
        await postMonthlySummaryForGuild(client, guild);
      } catch (err) {
        console.error(`Error publicando el resumen mensual del guild ${guild.guildId}:`, err);
      }
    }

    botStatus.recordCycle(TRACKER_KEY, { ok: true });
  } catch (err) {
    const shouldAlert = botStatus.recordCycle(TRACKER_KEY, { ok: false, error: err });
    if (shouldAlert) {
      await notifyOwner(
        client,
        `⚠️ El resumen mensual lleva ${botStatus.FAILURE_ALERT_THRESHOLD} ciclos seguidos fallando. Último error: ${err.message}`
      );
    }
    throw err;
  }
}

function startMonthlySummary(client) {
  checkMonthlySummaries(client).catch((err) =>
    console.error('Error en la primera comprobación del resumen mensual:', err)
  );
  setInterval(() => {
    checkMonthlySummaries(client).catch((err) => console.error('Error en el ciclo del resumen mensual:', err));
  }, CHECK_INTERVAL_MS);
}

module.exports = { startMonthlySummary };
