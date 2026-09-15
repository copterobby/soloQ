const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const userStore = require('../storage/userStore');

const data = new SlashCommandBuilder()
  .setName('unlink')
  .setDescription('Desvincula una cuenta de League of Legends')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario a desvincular (por defecto, tú mismo)').setRequired(false)
  );

async function execute(interaction) {
  const target = interaction.options.getUser('usuario') || interaction.user;
  const isSelf = target.id === interaction.user.id;

  if (!isSelf && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content:
        'Solo puedes desvincular tu propia cuenta. Para desvincular a otra persona necesitas el permiso "Gestionar servidor".',
      ephemeral: true,
    });
    return;
  }

  const existing = userStore.getUser(target.id);
  if (!existing) {
    await interaction.reply({ content: `${target} no tiene ninguna cuenta vinculada.`, ephemeral: true });
    return;
  }

  await userStore.deleteUser(target.id);
  await interaction.reply(`✅ Se ha desvinculado a ${target} de **${existing.gameName}#${existing.tagLine}**.`);
}

module.exports = { data, execute };
