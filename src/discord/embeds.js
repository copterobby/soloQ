const { EmbedBuilder } = require('discord.js');
const { championIconUrl, profileIconUrl } = require('../riot/ddragon');

const WIN_COLOR = 0x2ecc71;
const LOSS_COLOR = 0xe74c3c;
const NEUTRAL_COLOR = 0x5865f2;

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

const TIER_LABELS = {
  IRON: 'Hierro',
  BRONZE: 'Bronce',
  SILVER: 'Plata',
  GOLD: 'Oro',
  PLATINUM: 'Platino',
  EMERALD: 'Esmeralda',
  DIAMOND: 'Diamante',
  MASTER: 'Maestro',
  GRANDMASTER: 'Gran Maestro',
  CHALLENGER: 'Retador',
};
const NO_DIVISION_TIERS = new Set(['MASTER', 'GRANDMASTER', 'CHALLENGER']);

function formatRankedEntry(entry) {
  if (!entry) return 'Sin clasificar';
  const tierLabel = TIER_LABELS[entry.tier] || entry.tier;
  const divisionPart = NO_DIVISION_TIERS.has(entry.tier) ? '' : ` ${entry.rank}`;
  return `${tierLabel}${divisionPart} · ${entry.leaguePoints} LP`;
}

function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatNumber(value) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return String(value);
}

function formatKdaRatio(kills, deaths, assists) {
  if (deaths === 0) return 'Perfect';
  return ((kills + assists) / deaths).toFixed(2);
}

function buildGameHistoryEmbeds({ gameName, tagLine }, summaries, ddragonVersion, rankedEntry) {
  const wins = summaries.filter((s) => s.win).length;
  const losses = summaries.length - wins;
  const rankLine = rankedEntry
    ? `🏆 ${formatRankedEntry(rankedEntry)} (${rankedEntry.wins}V - ${rankedEntry.losses}D)`
    : '🏆 Sin clasificar en Ranked Solo/Duo';

  const header = new EmbedBuilder()
    .setTitle(`Historial de ${gameName}#${tagLine}`)
    .setColor(NEUTRAL_COLOR)
    .setDescription(
      summaries.length === 0
        ? `${rankLine}\nNo se encontraron partidas recientes de ranked solo/duo.`
        : `${rankLine}\n**Últimas ${summaries.length} partidas** · **${wins}V - ${losses}D**\nPulsa un botón de abajo para ver el detalle completo de esa partida (los 10 jugadores).`
    );

  if (ddragonVersion && summaries.length > 0) {
    header.setThumbnail(profileIconUrl(ddragonVersion, summaries[0].profileIconId));
  }

  const matchEmbeds = summaries.map((summary, index) => {
    const csPerMin = (summary.cs / (summary.durationSeconds / 60)).toFixed(1);
    const embed = new EmbedBuilder()
      .setTitle(
        `${NUMBER_EMOJIS[index] || `#${index + 1}`} ${summary.win ? '✅ Victoria' : '❌ Derrota'} — ${summary.championName}`
      )
      .setColor(summary.win ? WIN_COLOR : LOSS_COLOR)
      .addFields(
        {
          name: 'KDA',
          value: `${summary.kills}/${summary.deaths}/${summary.assists} (${formatKdaRatio(summary.kills, summary.deaths, summary.assists)})`,
          inline: true,
        },
        { name: 'CS', value: `${summary.cs} (${csPerMin}/min)`, inline: true },
        { name: 'Daño a campeones', value: formatNumber(summary.damageDealt), inline: true },
        { name: 'Visión', value: String(summary.visionScore), inline: true },
        { name: 'Duración', value: formatDuration(summary.durationSeconds), inline: true },
        { name: 'Cuándo', value: `<t:${summary.endTimestampSeconds}:R>`, inline: true }
      );

    if (ddragonVersion) {
      embed.setThumbnail(championIconUrl(ddragonVersion, summary.championName));
    }

    return embed;
  });

  return [header, ...matchEmbeds];
}

function buildMatchDetailEmbed(match, trackedPuuid, ddragonVersion, rankedEntries = new Map()) {
  const { info } = match;
  const tracked = info.participants.find((p) => p.puuid === trackedPuuid);
  const durationSeconds = info.gameDuration;
  const endSeconds = Math.floor(
    (info.gameEndTimestamp || info.gameStartTimestamp + info.gameDuration * 1000) / 1000
  );
  const patch = (info.gameVersion || '').split('.').slice(0, 2).join('.');

  const embed = new EmbedBuilder()
    .setTitle(`${tracked.win ? '✅ Victoria' : '❌ Derrota'} · Ranked Solo/Duo · ${formatDuration(durationSeconds)}`)
    .setColor(tracked.win ? WIN_COLOR : LOSS_COLOR)
    .setDescription(`🕐 <t:${endSeconds}:f>`)
    .setFooter({ text: `Parche ${patch}` })
    .setTimestamp(endSeconds * 1000);

  if (ddragonVersion) {
    embed.setThumbnail(championIconUrl(ddragonVersion, tracked.championName));
  }

  const totalTeamKills = {
    100: info.participants.filter((p) => p.teamId === 100).reduce((sum, p) => sum + p.kills, 0),
    200: info.participants.filter((p) => p.teamId === 200).reduce((sum, p) => sum + p.kills, 0),
  };

  for (const teamId of [100, 200]) {
    const players = info.participants.filter((p) => p.teamId === teamId);
    if (players.length === 0) continue;

    const label = teamId === 100 ? '🔵 Equipo Azul' : '🔴 Equipo Rojo';
    const resultLabel = players[0].win ? 'Victoria' : 'Derrota';
    const teamKills = totalTeamKills[teamId];
    const topDamage = Math.max(...players.map((p) => p.totalDamageDealtToChampions));

    const lines = players.map((p) => {
      const marker = p.puuid === trackedPuuid ? '➤ ' : '';
      const topDamageIcon = p.totalDamageDealtToChampions === topDamage ? ' 🔥' : '';
      const name = p.riotIdGameName || p.summonerName || '???';
      const kp = teamKills > 0 ? Math.round(((p.kills + p.assists) / teamKills) * 100) : 0;
      const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
      const rankText = formatRankedEntry(rankedEntries.get(p.puuid));

      return (
        `${marker}**${name}** — ${p.championName} \`Nv.${p.champLevel}\`${topDamageIcon}\n` +
        `🏆 ${rankText}\n` +
        `KDA **${p.kills}/${p.deaths}/${p.assists}** (${formatKdaRatio(p.kills, p.deaths, p.assists)}) · ` +
        `CS ${cs} · DMG ${formatNumber(p.totalDamageDealtToChampions)} · Oro ${formatNumber(p.goldEarned)} · ` +
        `KP ${kp}% · Visión ${p.visionScore}`
      );
    });

    embed.addFields({
      name: `${label} — ${resultLabel}`,
      value: lines.join('\n\n'),
    });
  }

  return embed;
}

module.exports = {
  buildGameHistoryEmbeds,
  buildMatchDetailEmbed,
  NUMBER_EMOJIS,
  formatRankedEntry,
  formatDuration,
  formatNumber,
};
