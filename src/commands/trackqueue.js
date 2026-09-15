const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildStore = require('../storage/guildStore');
const { QUEUE_IDS } = require('../riot/match');

const data = new SlashCommandBuilder()
  .setName('trackqueue')
  .setDescription('Elige qué colas se avisan automáticamente en este servidor')
  .addStringOption((option) =>
    option
      .setName('cola')
      .setDescription('Qué colas trackear')
      .setRequired(true)
      .addChoices(
        { name: 'Solo/Duo', value: 'solo' },
        { name: 'Flexible', value: 'flex' },
        { name: 'Ambas', value: 'both' }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const choice = interaction.options.getString('cola', true);
  const queues =
    choice === 'both' ? [QUEUE_IDS.SOLO, QUEUE_IDS.FLEX] : choice === 'flex' ? [QUEUE_IDS.FLEX] : [QUEUE_IDS.SOLO];
  const label = choice === 'both' ? 'Solo/Duo y Flexible' : choice === 'flex' ? 'Flexible' : 'Solo/Duo';

  await guildStore.setTrackedQueues(interaction.guildId, queues);

  await interaction.reply(`✅ A partir de ahora se avisará de partidas de **${label}** en este servidor.`);
}

module.exports = { data, execute };
