const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const config = require('./config');
const userStore = require('./storage/userStore');
const guildStore = require('./storage/guildStore');
const { startMatchTracker } = require('./tracker');
const { startWeeklySummary } = require('./weeklySummary');
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commandModules = [
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
];

client.commands = new Collection();
for (const command of commandModules) {
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
  startWeeklySummary(readyClient);
});

const LOGIN_RETRY_BASE_MS = 10 * 1000;
const LOGIN_RETRY_MAX_MS = 5 * 60 * 1000;

async function loginWithRetry() {
  let attempt = 0;
  for (;;) {
    try {
      await client.login(config.discordToken);
      return;
    } catch (err) {
      attempt += 1;
      const delayMs = Math.min(LOGIN_RETRY_BASE_MS * 2 ** (attempt - 1), LOGIN_RETRY_MAX_MS);
      console.error(
        `Error al conectar con Discord (intento ${attempt}): ${err.message}. Reintentando en ${delayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  await userStore.loadStore();
  await guildStore.loadStore();
  await loginWithRetry();
}

main().catch((err) => {
  console.error('Error fatal al arrancar el bot:', err);
  process.exit(1);
});
