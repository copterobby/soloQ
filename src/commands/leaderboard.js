const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const { getRankedSoloEntry } = require('../riot/league');
const { formatRankedEntry } = require('../discord/embeds');

const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];
const DIVISION_SCORE = { IV: 0, III: 1, II: 2, I: 3 };
const POSITION_MEDALS = ['🥇', '🥈', '🥉'];

const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('Leaderboard del servidor: compara el rango de ranked solo/duo de todos los vinculados');

function rankScore(entry) {
  if (!entry) return -1;
  const tierIndex = TIER_ORDER.indexOf(entry.tier);
  const divisionIndex = DIVISION_SCORE[entry.rank] ?? 0;
  return tierIndex * 400 + divisionIndex * 100 + entry.leaguePoints;
}

async function execute(interaction) {
  await interaction.deferReply();

  const users = userStore.getAllUsers();
  if (users.length === 0) {
    await interaction.editReply('Nadie ha vinculado su cuenta con `/loluser` todavía.');
    return;
  }

  const results = [];
  for (const user of users) {
    const member = await interaction.guild.members.fetch(user.discordId).catch(() => null);
    if (!member) continue;

    let entry = null;
    try {
      entry = await getRankedSoloEntry(user.puuid);
    } catch (err) {
      console.error(`Error obteniendo el rango de ${user.gameName}#${user.tagLine} para /leaderboard:`, err);
    }

    results.push({ user, entry, score: rankScore(entry) });
  }

  if (results.length === 0) {
    await interaction.editReply('Nadie vinculado está en este servidor.');
    return;
  }

  results.sort((a, b) => b.score - a.score);

  const lines = results.map((r, index) => {
    const medal = POSITION_MEDALS[index] || `#${index + 1}`;
    const rankText = formatRankedEntry(r.entry);
    const record = r.entry ? ` (${r.entry.wins}V - ${r.entry.losses}D)` : '';
    return `${medal} <@${r.user.discordId}> — **${rankText}**${record}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('🏆 Leaderboard del servidor — Ranked Solo/Duo')
    .setColor(0x5865f2)
    .setDescription(lines.join('\n'));

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
