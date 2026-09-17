const { SlashCommandBuilder } = require('discord.js');
const userStore = require('../storage/userStore');

const data = new SlashCommandBuilder()
  .setName('notifications')
  .setDescription('Activa o desactiva tus propios avisos automáticos de partida')
  .addStringOption((option) =>
    option
      .setName('estado')
      .setDescription('Activar o desactivar')
      .setRequired(true)
      .addChoices({ name: 'Activar', value: 'on' }, { name: 'Desactivar', value: 'off' })
  );

async function execute(interaction) {
  const existing = userStore.getUser(interaction.guildId, interaction.user.id);
  if (!existing) {
    await interaction.reply({
      content: 'Todavía no tienes una cuenta de LoL vinculada. Usa `/loluser` primero.',
      ephemeral: true,
    });
    return;
  }

  const enabled = interaction.options.getString('estado', true) === 'on';
  await userStore.setNotificationsEnabled(interaction.guildId, interaction.user.id, enabled);

  await interaction.reply({
    content: enabled
      ? '🔔 Avisos automáticos activados. Te avisaremos cuando termines una partida trackeada.'
      : '🔕 Avisos automáticos desactivados. No se publicará nada cuando juegues (puedes seguir usando `/leaderboard` y `/rank`).',
    ephemeral: true,
  });
}

module.exports = { data, execute };
