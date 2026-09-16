const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const guildStore = require('../storage/guildStore');
const { getRankedSoloEntry } = require('../riot/league');
const { getSeasonRecord, formatSeasonStart } = require('../riot/seasonRecord');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { formatRankedEntry } = require('../discord/embeds');
const { rankScore } = require('../util/rankScore');

const POSITION_MEDALS = ['🥇', '🥈', '🥉'];

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Leaderboard del servidor: compara el rango de ranked solo/duo de todos los vinculados');

async function execute(interaction) {
  await interaction.deferReply();

  const users = userStore.getAllUsers();
  if (users.length === 0) {
    await interaction.editReply('Nadie ha vinculado su cuenta con `/loluser` todavía.');
    return;
  }

  const startSeconds = guildStore.getChallengeStart(interaction.guildId);
  const startText = formatSeasonStart(startSeconds);

  let results;
  try {
    results = [];
    for (const user of users) {
      const member = await interaction.guild.members.fetch(user.discordId).catch(() => null);
      if (!member) continue;

      let entry = null;
      let record = { wins: 0, losses: 0, games: 0, truncated: false };
      try {
        [entry, record] = await Promise.all([
          getRankedSoloEntry(user.puuid),
          getSeasonRecord(user.puuid, startSeconds),
        ]);
      } catch (err) {
        if (err instanceof RiotRateLimitError) throw err; // deja que se propague: seguir sería mostrar datos falsos
        console.error(`Error obteniendo el rango de ${user.gameName}#${user.tagLine} para /leaderboard:`, err);
      }

      results.push({ user, entry, record, score: rankScore(entry) });
    }
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /leaderboard:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /leaderboard:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
    return;
  }

  if (results.length === 0) {
    await interaction.editReply('Nadie vinculado está en este servidor.');
    return;
  }

  results.sort((a, b) => b.score - a.score);

  const lines = results.map((r, index) => {
    const medal = POSITION_MEDALS[index] || `#${index + 1}`;
    const rankText = formatRankedEntry(r.entry);
    const truncatedMark = r.record.truncated ? ' ⚠️' : '';
    const recordText =
      r.record.games > 0 ? ` (${r.record.wins}V - ${r.record.losses}D desde el ${startText}${truncatedMark})` : '';
    return `${medal} <@${r.user.discordId}> — **${rankText}**${recordText}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Leaderboard del servidor — Ranked Solo/Duo')
    .setColor(0x5865f2)
    .setDescription(lines.join('\n'));

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
