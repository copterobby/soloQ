const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const userStore = require('../storage/userStore');
const guildStore = require('../storage/guildStore');
const { getMatchIdsByQueue, getMatchById } = require('../riot/match');
const { RiotRateLimitError } = require('../riot/client');
const { getLatestVersion } = require('../riot/ddragon');
const { getRankedSoloEntriesByPuuid } = require('../riot/league');
const { buildMatchDetailEmbed } = require('../discord/embeds');
const { withLock } = require('../util/lock');
const { buildHighlights } = require('../tracker');

const SYNC_CHECK_COUNT = 20;

const data = new SlashCommandBuilder()
  .setName('syncgames')
  .setDescription('Revisa y publica las partidas de todos los usuarios vinculados que no se hayan avisado todavía')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

async function collectNewMatchIds(user, queueId) {
  let matchIds;
  try {
    matchIds = await getMatchIdsByQueue(user.puuid, queueId, SYNC_CHECK_COUNT);
  } catch (err) {
    return { error: err };
  }

  if (matchIds.length === 0) return { newMatchIds: [] };

  const lastSeen = userStore.getLastSeenMatchId(user, queueId);
  const lastSeenIndex = lastSeen ? matchIds.indexOf(lastSeen) : -1;
  let newMatchIds;
  let truncated = false;
  if (lastSeenIndex === 0) {
    newMatchIds = [];
  } else if (lastSeenIndex === -1) {
    newMatchIds = matchIds;
    truncated = true;
  } else {
    newMatchIds = matchIds.slice(0, lastSeenIndex);
  }

  return { newMatchIds: newMatchIds.reverse(), latestMatchId: matchIds[0], truncated };
}

async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const channelId = guildStore.getTrackedChannelId(interaction.guildId);
  if (!channelId) {
    await interaction.editReply('Este servidor no tiene un canal configurado. Usa `/trackchannel` primero.');
    return;
  }

  const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply('No pude acceder al canal configurado. Revisa que exista y que tenga permisos.');
    return;
  }

  const trackedQueues = guildStore.getTrackedQueues(interaction.guildId);

  const users = userStore.getAllUsers();
  if (users.length === 0) {
    await interaction.editReply('No hay ningún usuario vinculado con `/loluser` todavía.');
    return;
  }

  let ddragonVersion = null;
  try {
    ddragonVersion = await getLatestVersion();
  } catch (err) {
    console.error('No se pudo obtener la versión de Data Dragon para /syncgames:', err);
  }

  let totalPosted = 0;
  let anyTruncated = false;
  let rateLimited = false;
  const errors = [];

  outer: for (const user of users) {
    const member = await interaction.guild.members.fetch(user.discordId).catch(() => null);
    if (!member) continue;

    for (const queueId of trackedQueues) {
      // Mismo bloqueo que usa el tracker automático para (usuario, cola): evita publicar
      // la misma partida dos veces si el poller de 5 minutos corre justo a la vez.
      const stoppedForRateLimit = await withLock(`${user.discordId}:${queueId}`, async () => {
        const { newMatchIds, latestMatchId, truncated, error } = await collectNewMatchIds(user, queueId);

        if (error) {
          if (error instanceof RiotRateLimitError) {
            errors.push(`${user.gameName}#${user.tagLine}: rate limit de Riot`);
            return true;
          }
          console.error(`Error comprobando a ${user.gameName}#${user.tagLine} en /syncgames:`, error);
          errors.push(`${user.gameName}#${user.tagLine}: error consultando Riot`);
          return false;
        }

        if (!newMatchIds || newMatchIds.length === 0) return false;
        if (truncated) anyTruncated = true;

        for (const matchId of newMatchIds) {
          try {
            const match = await getMatchById(matchId);
            const tracked = match.info.participants.find((p) => p.puuid === user.puuid);
            const resultText = tracked.win ? 'ha ganado' : 'ha perdido';
            const streak = await userStore.updateStreak(user.discordId, queueId, tracked.win);
            const highlights = buildHighlights(tracked, streak);
            const highlightsText = highlights.length > 0 ? `\n${highlights.join(' · ')}` : '';
            const rankedEntries = await getRankedSoloEntriesByPuuid(match.info.participants.map((p) => p.puuid));
            const embed = buildMatchDetailEmbed(match, user.puuid, ddragonVersion, rankedEntries);

            await channel.send({
              content: `🎮 <@${user.discordId}> ${resultText} una partida jugando **${tracked.championName}**${highlightsText}`,
              embeds: [embed],
            });
            totalPosted += 1;
          } catch (err) {
            if (err instanceof RiotRateLimitError) {
              errors.push(`${user.gameName}#${user.tagLine}: rate limit de Riot a mitad de sincronizar`);
              return true;
            }
            console.error(`Error publicando la partida ${matchId} de ${user.gameName}#${user.tagLine}:`, err);
            errors.push(`${user.gameName}#${user.tagLine}: error publicando una partida`);
          }
        }

        if (latestMatchId) {
          await userStore.setLastSeenMatchId(user.discordId, queueId, latestMatchId);
        }
        return false;
      });

      if (stoppedForRateLimit) {
        rateLimited = true;
        break outer;
      }
    }
  }

  const summary = [`✅ Sincronización ${rateLimited ? 'parcial' : 'completa'}: ${totalPosted} partida(s) publicada(s) en ${channel}.`];
  if (rateLimited) {
    summary.push('⚠️ Riot empezó a limitar peticiones a mitad de la sincronización — espera un par de minutos y vuelve a ejecutar `/syncgames` para terminar.');
  }
  if (anyTruncated) {
    summary.push(
      `⚠️ Algún usuario tenía más de ${SYNC_CHECK_COUNT} partidas pendientes; solo se muestran las últimas ${SYNC_CHECK_COUNT}.`
    );
  }
  if (errors.length > 0) {
    summary.push(`⚠️ Errores:\n${errors.map((e) => `- ${e}`).join('\n')}`);
  }

  await interaction.editReply(summary.join('\n'));
}

module.exports = { data, execute };
