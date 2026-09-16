const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const guildStore = require('../storage/guildStore');
const { getRankedSoloEntry } = require('../riot/league');
const { getSeasonRecord, formatSeasonStart } = require('../riot/seasonRecord');
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
    const startSeconds = guildStore.getChallengeStart(interaction.guildId);
    const startText = formatSeasonStart(startSeconds);

    const [entry, record] = await Promise.all([
      getRankedSoloEntry(registeredUser.puuid),
      getSeasonRecord(registeredUser.puuid, startSeconds),
    ]);

    const winrate = record.games > 0 ? Math.round((record.wins / record.games) * 100) : null;
    const truncatedNote = record.truncated ? ' ⚠️ (más de 300 partidas, mostrando las más recientes)' : '';

    const embed = new EmbedBuilder()
      .setTitle(`${registeredUser.gameName}#${registeredUser.tagLine}`)
      .setColor(0x5865f2)
      .setDescription(
        `🏆 **${formatRankedEntry(entry)}**\n` +
          (record.games > 0
            ? `Desde el ${startText}: ${record.wins}V - ${record.losses}D (${winrate}% winrate)${truncatedNote}`
            : `Sin partidas de ranked solo/duo desde el ${startText}`)
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
