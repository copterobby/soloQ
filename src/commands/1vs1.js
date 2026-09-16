const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const guildStore = require('../storage/guildStore');
const { getRankedSoloEntry } = require('../riot/league');
const { getSeasonMatches, formatSeasonStart } = require('../riot/seasonRecord');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { formatRankedEntry, formatNumber } = require('../discord/embeds');
const { rankScore } = require('../util/rankScore');

const data = new SlashCommandBuilder()
  .setName('1vs1')
  .setDescription('Compara cara a cara a dos usuarios vinculados')
  .addUserOption((option) => option.setName('usuario1').setDescription('Primer usuario').setRequired(true))
  .addUserOption((option) => option.setName('usuario2').setDescription('Segundo usuario').setRequired(true));

async function collectPlayerStats(discordUser, startSeconds) {
  const registeredUser = userStore.getUser(discordUser.id);
  if (!registeredUser) return { error: true, discordUser };

  const [{ matches, truncated }, rankedEntry] = await Promise.all([
    getSeasonMatches(registeredUser.puuid, startSeconds),
    getRankedSoloEntry(registeredUser.puuid).catch(() => null),
  ]);

  const summaries = matches.map((match) => {
    const p = match.info.participants.find((participant) => participant.puuid === registeredUser.puuid);
    return {
      win: p.win,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      cs: p.totalMinionsKilled + p.neutralMinionsKilled,
      damage: p.totalDamageDealtToChampions,
      durationSeconds: match.info.gameDuration,
    };
  });

  const games = summaries.length;
  const wins = summaries.filter((s) => s.win).length;
  const sum = (key) => summaries.reduce((total, s) => total + s[key], 0);
  const avgKills = games > 0 ? sum('kills') / games : 0;
  const avgDeaths = games > 0 ? sum('deaths') / games : 0;
  const avgAssists = games > 0 ? sum('assists') / games : 0;
  const avgCsPerMin =
    games > 0 ? summaries.reduce((total, s) => total + s.cs / (s.durationSeconds / 60), 0) / games : 0;
  const avgDamage = games > 0 ? sum('damage') / games : 0;

  return {
    rankedEntry,
    truncated,
    games,
    wins,
    losses: games - wins,
    avgKills,
    avgDeaths,
    avgAssists,
    avgCsPerMin,
    avgDamage,
  };
}

function buildPlayerField(stats, startText) {
  if (stats.error) {
    return `${stats.discordUser} no tiene cuenta vinculada. Usa \`/loluser\` primero.`;
  }

  const { rankedEntry, truncated, games, wins, losses, avgKills, avgDeaths, avgAssists, avgCsPerMin, avgDamage } =
    stats;
  const kdaRatio = avgDeaths > 0 ? ((avgKills + avgAssists) / avgDeaths).toFixed(2) : 'Perfect';
  const truncatedNote = truncated ? ' ⚠️ (más de 300 partidas, mostrando las más recientes)' : '';

  const lines = [
    `🏆 ${formatRankedEntry(rankedEntry)}`,
    games > 0
      ? `Desde el ${startText}: **${wins}V - ${losses}D** (${games} partidas)${truncatedNote}`
      : `Sin partidas de ranked solo/duo desde el ${startText}`,
  ];

  if (games > 0) {
    lines.push(
      `KDA medio: ${avgKills.toFixed(1)}/${avgDeaths.toFixed(1)}/${avgAssists.toFixed(1)} (${kdaRatio})`,
      `CS/min: ${avgCsPerMin.toFixed(1)} · Daño medio: ${formatNumber(Math.round(avgDamage))}`
    );
  }

  return lines.join('\n');
}

async function execute(interaction) {
  const user1Discord = interaction.options.getUser('usuario1', true);
  const user2Discord = interaction.options.getUser('usuario2', true);

  if (user1Discord.id === user2Discord.id) {
    await interaction.reply({ content: 'Elige a dos usuarios distintos.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const startSeconds = guildStore.getChallengeStart(interaction.guildId);
    const startText = formatSeasonStart(startSeconds);

    const [stats1, stats2] = await Promise.all([
      collectPlayerStats(user1Discord, startSeconds),
      collectPlayerStats(user2Discord, startSeconds),
    ]);

    const embed = new EmbedBuilder()
      .setTitle(`⚔️ ${user1Discord.username} vs ${user2Discord.username}`)
      .setColor(0x5865f2)
      .addFields(
        { name: `🔵 ${user1Discord.username}`, value: buildPlayerField(stats1, startText), inline: true },
        { name: `🔴 ${user2Discord.username}`, value: buildPlayerField(stats2, startText), inline: true }
      );

    if (!stats1.error && !stats2.error) {
      const score1 = rankScore(stats1.rankedEntry);
      const score2 = rankScore(stats2.rankedEntry);
      if (score1 > score2) {
        embed.setDescription(`🏅 Va ganando en rango: ${user1Discord}`);
      } else if (score2 > score1) {
        embed.setDescription(`🏅 Va ganando en rango: ${user2Discord}`);
      } else {
        embed.setDescription('🤝 Mismo rango');
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /1vs1:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /1vs1:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
