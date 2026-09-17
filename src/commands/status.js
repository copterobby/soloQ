const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const botStatus = require('../botStatus');

const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Muestra el estado del bot: trackers y vinculados en este servidor');

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

function formatTrackerLine(label, tracker) {
  if (!tracker || !tracker.lastRunAt) return `${label}: sin ejecutar todavía`;
  const lastRun = `<t:${Math.floor(new Date(tracker.lastRunAt).getTime() / 1000)}:R>`;
  if (tracker.consecutiveFailures > 0) {
    return `${label}: ⚠️ fallando (${tracker.consecutiveFailures} ciclo(s) seguidos) · último intento ${lastRun}`;
  }
  return `${label}: ✅ ok · último ciclo ${lastRun}`;
}

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const status = botStatus.getStatus();
  const lolUsers = userStore.getAllUsers(interaction.guildId).length;

  const embed = new EmbedBuilder()
    .setTitle('🩺 Estado del bot')
    .setColor(0x5865f2)
    .addFields(
      { name: 'Uptime', value: formatUptime(interaction.client.uptime), inline: true },
      { name: 'Servidores', value: String(interaction.client.guilds.cache.size), inline: true },
      { name: 'Vinculados aquí', value: `LoL: ${lolUsers}`, inline: true },
      {
        name: 'Trackers',
        value: [
          formatTrackerLine('League', status.lol),
          formatTrackerLine('Resumen semanal', status.weeklySummary),
          formatTrackerLine('Resumen mensual', status.monthlySummary),
        ].join('\n'),
      }
    );

  await interaction.editReply({ embeds: [embed] });
}

module.exports = { data, execute };
