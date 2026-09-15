const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const guildStore = require('../storage/guildStore');

const data = new SlashCommandBuilder()
  .setName('trackchannel')
  .setDescription('Configura el canal donde se avisará cuando alguien juegue una partida')
  .addChannelOption((option) =>
    option
      .setName('canal')
      .setDescription('Canal de texto donde se enviarán los avisos')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const channel = interaction.options.getChannel('canal', true);

  await guildStore.setTrackedChannel(interaction.guildId, channel.id);

  await interaction.reply(
    `✅ A partir de ahora avisaré en ${channel} cuando alguien de \`/loluser\` juegue una partida de ranked solo/duo.`
  );
}

module.exports = { data, execute };
