const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { getRankedSoloMatches } = require('../riot/match');
const { RiotRateLimitError, RiotApiError } = require('../riot/client');
const { getLatestVersion } = require('../riot/ddragon');
const { getRankedSoloEntry, getRankedSoloEntriesByPuuid } = require('../riot/league');
const { buildGameHistoryEmbeds, buildMatchDetailEmbed, NUMBER_EMOJIS } = require('../discord/embeds');
const userStore = require('../storage/userStore');

const MATCH_COUNT = 5;
const COLLECTOR_DURATION_MS = 5 * 60 * 1000;

const data = new SlashCommandBuilder()
  .setName('games')
  .setDescription('Muestra el historial reciente de ranked solo/duo de un usuario')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Usuario de Discord a consultar').setRequired(true)
  );

function summarizeMatch(match, puuid) {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  return {
    matchId: match.metadata.matchId,
    win: participant.win,
    championName: participant.championName,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
    damageDealt: participant.totalDamageDealtToChampions,
    visionScore: participant.visionScore,
    profileIconId: participant.profileIcon,
    durationSeconds: match.info.gameDuration,
    endTimestampSeconds: Math.floor(
      (match.info.gameEndTimestamp || match.info.gameStartTimestamp + match.info.gameDuration * 1000) / 1000
    ),
  };
}

async function safeGetVersion() {
  try {
    return await getLatestVersion();
  } catch (err) {
    console.error('No se pudo obtener la versión de Data Dragon:', err);
    return null;
  }
}

async function safeGetRankedEntry(puuid) {
  try {
    return await getRankedSoloEntry(puuid);
  } catch (err) {
    console.error('No se pudo obtener el rango del jugador:', err);
    return null;
  }
}

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
    const [matches, ddragonVersion, rankedEntry] = await Promise.all([
      getRankedSoloMatches(registeredUser.puuid, MATCH_COUNT),
      safeGetVersion(),
      safeGetRankedEntry(registeredUser.puuid),
    ]);

    const summaries = matches.map((match) => summarizeMatch(match, registeredUser.puuid));
    const embeds = buildGameHistoryEmbeds(registeredUser, summaries, ddragonVersion, rankedEntry);
    const matchesById = new Map(matches.map((match) => [match.metadata.matchId, match]));

    const row = new ActionRowBuilder().addComponents(
      summaries.map((summary, index) =>
        new ButtonBuilder()
          .setCustomId(`matchDetail:${summary.matchId}`)
          .setEmoji(NUMBER_EMOJIS[index])
          .setStyle(ButtonStyle.Secondary)
      )
    );

    const components = summaries.length > 0 ? [row] : [];
    const response = await interaction.editReply({ embeds, components });

    if (summaries.length === 0) return;

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_DURATION_MS,
    });

    collector.on('collect', async (buttonInteraction) => {
      if (buttonInteraction.user.id !== interaction.user.id) {
        await buttonInteraction.reply({
          content: 'Solo quien pidió este historial puede ver el detalle de las partidas.',
          ephemeral: true,
        });
        return;
      }

      const matchId = buttonInteraction.customId.split(':')[1];
      const match = matchesById.get(matchId);
      if (!match) {
        await buttonInteraction.reply({ content: 'No se encontró esa partida.', ephemeral: true });
        return;
      }

      await buttonInteraction.deferReply({ ephemeral: true });
      try {
        const rankedEntries = await getRankedSoloEntriesByPuuid(match.info.participants.map((p) => p.puuid));
        const detailEmbed = buildMatchDetailEmbed(match, registeredUser.puuid, ddragonVersion, rankedEntries);
        await buttonInteraction.editReply({ embeds: [detailEmbed] });
      } catch (err) {
        console.error('Error mostrando el detalle de la partida en /games:', err);
        await buttonInteraction.editReply('Ha ocurrido un error mostrando el detalle de esta partida.').catch(() => {});
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder().addComponents(
        row.components.map((button) => ButtonBuilder.from(button).setDisabled(true))
      );
      await interaction.editReply({ components: [disabledRow] }).catch(() => {});
    });
  } catch (err) {
    if (err instanceof RiotRateLimitError) {
      await interaction.editReply(`Riot API está limitando peticiones. Inténtalo de nuevo en ${err.retryAfterSeconds}s.`);
      return;
    }
    if (err instanceof RiotApiError) {
      console.error('Riot API error en /games:', err.status, err.body);
      await interaction.editReply('Error consultando la API de Riot. Inténtalo más tarde.');
      return;
    }
    console.error('Error inesperado en /games:', err);
    await interaction.editReply('Ha ocurrido un error inesperado.');
  }
}

module.exports = { data, execute };
