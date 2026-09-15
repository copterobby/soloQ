const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const { getRankedSoloEntry } = require('../riot/league');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { formatRankedEntry } = require('../discord/embeds');

const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('Consulta el rango actual de ranked solo/duo de un usuario')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario de Discord a consultar').setRequired(true)
  );

async function execute(interaction) {
  const discordUser = interaction.options.getUser('usuario', true);
  const registeredUser = userStore.getUser(discordUser.id);

  if (!registeredUser) {
    await interaction.reply({
      content: `${discordUser} todavía no tiene una cuenta de LoL vinculada. Usa \`/loluser\` primero.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const entry = await getRankedSoloEntry(registeredUser.puuid);
    const winrate = entry && entry.wins + entry.losses > 0
      ? Math.round((entry.wins / (entry.wins + entry.losses)) * 100)
      : null;

    const embed = new EmbedBuilder()
      .setTitle(`${registeredUser.gameName}#${registeredUser.tagLine}`)
      .setColor(0x5865f2)
      .setDescription(
        entry
          ? `🏆 **${formatRankedEntry(entry)}**\n${entry.wins}V - ${entry.losses}D (${winrate}% winrate)`
          : '🏆 Sin clasificar en Ranked Solo/Duo'
      );

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /rank:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /rank:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
