const { REST, Routes } = require('discord.js');
const config = require('./config');
const loluser = require('./commands/loluser');
const games = require('./commands/games');
const leaderboard = require('./commands/leaderboard');
const trackchannel = require('./commands/trackchannel');
const testgame = require('./commands/testgame');
const syncgames = require('./commands/syncgames');
const unlink = require('./commands/unlink');
const rank = require('./commands/rank');
const notifications = require('./commands/notifications');
const trackqueue = require('./commands/trackqueue');
const weekconfig = require('./commands/weekconfig');
const weekcount = require('./commands/weekcount');
const oneVsOne = require('./commands/1vs1');

const commands = [
  loluser,
  games,
  leaderboard,
  trackchannel,
  testgame,
  syncgames,
  unlink,
  rank,
  notifications,
  trackqueue,
  weekconfig,
  weekcount,
  oneVsOne,
].map((command) => command.data.toJSON());

const rest = new REST().setToken(config.discordToken);

// --global fuerza el registro global (todos los servidores donde esté el bot) aunque
// DISCORD_GUILD_ID esté puesto en el .env, sin tener que editar el .env cada vez.
const forceGlobal = process.argv.includes('--global');
const useGuildScope = config.discordGuildId && !forceGlobal;

async function main() {
  const route = useGuildScope
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  console.log(
    useGuildScope
      ? `Registrando ${commands.length} comandos en el guild ${config.discordGuildId}...`
      : `Registrando ${commands.length} comandos globalmente (puede tardar hasta 1h en propagarse)...`
  );

  await rest.put(route, { body: commands });
  console.log('Comandos registrados correctamente.');
}

main().catch((err) => {
  console.error('Error registrando comandos:', err);
  process.exit(1);
});
