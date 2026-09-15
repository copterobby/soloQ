const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const guildStore = require('../storage/guildStore');
const { DAY_NAMES } = require('../util/weekSchedule');

const data = new SlashCommandBuilder()
  .setName('weekconfig')
  .setDescription('Configura cuándo empieza la semana para /weekcount y el resumen semanal')
  .addIntegerOption((option) =>
    option
      .setName('dia')
      .setDescription('Día de la semana en que empieza la semana')
      .setRequired(true)
      .addChoices(
        { name: 'Lunes', value: 1 },
        { name: 'Martes', value: 2 },
        { name: 'Miércoles', value: 3 },
        { name: 'Jueves', value: 4 },
        { name: 'Viernes', value: 5 },
        { name: 'Sábado', value: 6 },
        { name: 'Domingo', value: 0 }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName('hora')
      .setDescription('Hora del día (0-23, en la hora del servidor donde corre el bot)')
      .setRequired(true)
      .setMinValue(0)
      .setMaxValue(23)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function execute(interaction) {
  const day = interaction.options.getInteger('dia', true);
  const hour = interaction.options.getInteger('hora', true);

  await guildStore.setWeekSchedule(interaction.guildId, day, hour);

  await interaction.reply(
    `✅ La semana ahora empieza (y termina) los **${DAY_NAMES[day]} a las ${String(hour).padStart(2, '0')}:00**. ` +
      `\`/weekcount\` y el resumen semanal automático usarán este horario a partir de ahora.`
  );
}

module.exports = { data, execute };
