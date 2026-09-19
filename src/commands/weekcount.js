const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const userStore = require('../storage/userStore');
const guildStore = require('../storage/guildStore');
const { getMatchIdsInRange, getMatchById } = require('../riot/match');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { getMostRecentWeekStart, DAY_NAMES } = require('../util/weekSchedule');
const { isRemake } = require('../util/remake');

const MAX_MATCHES_PER_QUEUE = 30;

const data = new SlashCommandBuilder()
  .setName('weekcount')
  .setDescription('Cuenta las partidas jugadas por un usuario desde el inicio de la semana configurada')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario de Discord a consultar').setRequired(true)
  );

async function execute(interaction) {
  const discordUser = interaction.options.getUser('usuario', true);
  const registeredUser = userStore.getUser(interaction.guildId, discordUser.id);

  if (!registeredUser) {
    await interaction.reply({
      content: `${discordUser} todavía no tiene una cuenta de LoL vinculada. Usa \`/loluser\` primero.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const { day, hour } = guildStore.getWeekSchedule(interaction.guildId);
    const trackedQueues = guildStore.getTrackedQueues(interaction.guildId);
    const weekStart = getMostRecentWeekStart(day, hour);
    const startTimeSeconds = Math.floor(weekStart.getTime() / 1000);

    let wins = 0;
    let losses = 0;

    for (const queueId of trackedQueues) {
      const matchIds = await getMatchIdsInRange(registeredUser.puuid, queueId, {
        startTimeSeconds,
        count: MAX_MATCHES_PER_QUEUE,
      });

      for (const matchId of matchIds) {
        const match = await getMatchById(matchId);
        if (isRemake(match)) continue;
        const tracked = match.info.participants.find((p) => p.puuid === registeredUser.puuid);
        if (tracked.win) wins += 1;
        else losses += 1;
      }
    }

    const total = wins + losses;
    const winrate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const scheduleText = `${DAY_NAMES[day]} a las ${String(hour).padStart(2, '0')}:00`;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Partidas de ${registeredUser.gameName}#${registeredUser.tagLine} esta semana`)
      .setColor(0x5865f2)
      .setDescription(
        total > 0
          ? `**${total}** partidas · ${wins}V - ${losses}D (${winrate}%)`
          : 'Todavía no ha jugado ninguna partida desde que empezó la semana.'
      )
      .setFooter({ text: `Semana desde el ${scheduleText} · configúralo con /weekconfig` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /weekcount:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /weekcount:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
