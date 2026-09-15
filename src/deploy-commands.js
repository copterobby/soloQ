const { REST, Routes } = require('discord.js');
const config = require('./config');
const loluser = require('./commands/loluser');
const leaderboard = require('./commands/leaderboard');
const trackchannel = require('./commands/trackchannel');
const testgame = require('./commands/testgame');
const syncgames = require('./commands/syncgames');

const commands = [loluser, leaderboard, trackchannel, testgame, syncgames].map((command) =>
  command.data.toJSON()
);
const rest = new REST().setToken(config.discordToken);

async function main() {
  const route = config.discordGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId)
    : Routes.applicationCommands(config.discordClientId);

  console.log(
    config.discordGuildId
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
