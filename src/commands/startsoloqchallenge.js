const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildStore = require('../storage/guildStore');

const data = new SlashCommandBuilder()
  .setName('startsoloqchallenge')
  .setDescription('Establece la fecha de inicio del SoloQ Challenge de este servidor')
  .addStringOption((option) =>
    option
      .setName('fecha')
      .setDescription('Fecha de inicio en formato DD/MM/AAAA (ej: 15/09/2026)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function parseDate(input) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null; // rechaza fechas inválidas tipo 31/02/2026
  }

  return date;
}

async function execute(interaction) {
  const input = interaction.options.getString('fecha', true);
  const date = parseDate(input);

  if (!date) {
    await interaction.reply({
      content: 'Formato de fecha inválido. Usa DD/MM/AAAA, por ejemplo `15/09/2026`.',
      ephemeral: true,
    });
    return;
  }

  const startSeconds = Math.floor(date.getTime() / 1000);
  await guildStore.setChallengeStart(interaction.guildId, startSeconds);

  await interaction.reply(
    `✅ El **SoloQ Challenge** de este servidor empieza a contar desde el **${input}**. ` +
      `\`/rank\`, \`/leaderboard\` y \`/1vs1\` usarán esta fecha a partir de ahora.`
  );
}

module.exports = { data, execute };
