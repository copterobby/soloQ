const { SlashCommandBuilder } = require('discord.js');
const { getAccountByRiotId } = require('../riot/account');
const { RiotNotFoundError, RiotRateLimitError, RiotApiError } = require('../riot/client');
const userStore = require('../storage/userStore');

const data = new SlashCommandBuilder()
  .setName('loluser')
  .setDescription('Vincula un usuario de Discord con su cuenta de League of Legends')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario de Discord a vincular').setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('usuariolol')
      .setDescription('Riot ID en formato nombre#tag (ej: Faker#KR1)')
      .setRequired(true)
  );

async function execute(interaction) {
  const discordUser = interaction.options.getUser('usuario', true);
  const riotIdInput = interaction.options.getString('usuariolol', true);

  const separatorIndex = riotIdInput.lastIndexOf('#');
  if (separatorIndex === -1) {
    await interaction.reply({
      content: 'Formato inválido. Usa `nombre#tag`, por ejemplo `Faker#KR1`.',
      ephemeral: true,
    });
    return;
  }

  const gameName = riotIdInput.slice(0, separatorIndex);
  const tagLine = riotIdInput.slice(separatorIndex + 1);

  await interaction.deferReply();

  try {
    const account = await getAccountByRiotId(gameName, tagLine);
    await userStore.setUser(discordUser.id, {
      gameName: account.gameName,
      tagLine: account.tagLine,
      puuid: account.puuid,
    });

    await interaction.editReply(
      `✅ ${discordUser} vinculado a **${account.gameName}#${account.tagLine}**.`
    );
  } catch (err) {
    if (err instanceof RiotNotFoundError) {
      await interaction.editReply(
        `No se encontró ninguna cuenta con Riot ID **${gameName}#${tagLine}**. Revisa el nombre y el tag.`
      );
      return;
    }
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(
        `Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`
      );
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /loluser:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /loluser:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
