const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const config = require('./config');
const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { startMatchTracker } = require('./tracker');
const loluser = require('./commands/loluser');
const leaderboard = require('./commands/leaderboard');
const trackchannel = require('./commands/trackchannel');
const testgame = require('./commands/testgame');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();
for (const command of [loluser, leaderboard, trackchannel, testgame]) {
  client.commands.set(command.data.name, command);
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error ejecutando /${interaction.commandName}:`, err);
    const errorReply = { content: 'Ha ocurrido un error ejecutando el comando.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(errorReply).catch(() => {});
    } else {
      await interaction.reply(errorReply).catch(() => {});
    }
  }
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot conectado como ${readyClient.user.tag}`);
  startMatchTracker(readyClient);
});

async function main() {
  await userStore.loadStore();
  await guildStore.loadStore();
  await client.login(config.discordToken);
}

main().catch((err) => {
  console.error('Error al arrancar el bot:', err);
  process.exit(1);
});
