const { REST, Routes } = require('discord.js');
const config = require('./config');
const { commandModules } = require('./commands/registry');

const commands = commandModules.map((command) => command.data.toJSON());

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
