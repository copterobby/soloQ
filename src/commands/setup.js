const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const guildStore = require('../storage/guildStore');
const { QUEUE_IDS } = require('../riot/match');

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configura de una vez el canal y las colas de League of Legends de este servidor')
  .addChannelOption((option) =>
    option
      .setName('canal_lol')
      .setDescription('Canal de avisos de League of Legends')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addStringOption((option) =>
    option
      .setName('colas_lol')
      .setDescription('Colas de League a trackear')
      .setRequired(false)
      .addChoices(
        { name: 'Solo/Duo', value: 'solo' },
        { name: 'Flexible', value: 'flex' },
        { name: 'Ambas', value: 'both' }
      )
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const canalLol = interaction.options.getChannel('canal_lol');
  const colasLol = interaction.options.getString('colas_lol');

  if (!canalLol && !colasLol) {
    await interaction.reply({
      content:
        'No has indicado ninguna opción. Usa `/setup canal_lol:` / `colas_lol:` (ambas opcionales, se aplican solo las que indiques). También puedes seguir usando `/trackchannel` y `/trackqueue` por separado.',
      ephemeral: true,
    });
    return;
  }

  const applied = [];

  if (canalLol) {
    await guildStore.setTrackedChannel(interaction.guildId, canalLol.id);
    applied.push(`✅ Canal de League: ${canalLol}`);
  }

  if (colasLol) {
    const queues = colasLol === 'both' ? [QUEUE_IDS.SOLO, QUEUE_IDS.FLEX] : colasLol === 'flex' ? [QUEUE_IDS.FLEX] : [QUEUE_IDS.SOLO];
    const label = colasLol === 'both' ? 'Solo/Duo y Flexible' : colasLol === 'flex' ? 'Flexible' : 'Solo/Duo';
    await guildStore.setTrackedQueues(interaction.guildId, queues);
    applied.push(`✅ Colas de League: ${label}`);
  }

  await interaction.reply(applied.join('\n'));
}

module.exports = { data, execute };
