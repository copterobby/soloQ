const { SlashCommandBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const { getRankedSoloMatchIds, getMatchById } = require('../riot/match');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { getLatestVersion } = require('../riot/ddragon');
const { buildMatchDetailEmbed } = require('../discord/embeds');

const OWNER_DISCORD_ID = '495739540644954127';

const data = new SlashCommandBuilder()
  .setName('testgame')
  .setDescription('[Owner] Prueba el aviso de partida con la última partida de un usuario')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario de Discord vinculado a probar').setRequired(true)
  );

async function execute(interaction) {
  if (interaction.user.id !== OWNER_DISCORD_ID) {
    await interaction.reply({ content: 'No tienes permiso para usar este comando.', ephemeral: true });
    return;
  }

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
    const matchIds = await getRankedSoloMatchIds(registeredUser.puuid, 1);
    if (matchIds.length === 0) {
      await interaction.editReply(`${discordUser} no tiene partidas de ranked solo/duo recientes.`);
      return;
    }

    const [match, ddragonVersion] = await Promise.all([
      getMatchById(matchIds[0]),
      getLatestVersion().catch(() => null),
    ]);

    const tracked = match.info.participants.find((p) => p.puuid === registeredUser.puuid);
    const resultText = tracked.win ? 'ha ganado' : 'ha perdido';
    const embed = buildMatchDetailEmbed(match, registeredUser.puuid, ddragonVersion);

    await interaction.editReply({
      content: `🎮 [TEST] <@${discordUser.id}> ${resultText} una partida jugando **${tracked.championName}**`,
      embeds: [embed],
    });
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /testgame:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /testgame:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
