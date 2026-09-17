require('dotenv').config();

const required = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'RIOT_API_KEY'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `Faltan variables de entorno obligatorias: ${missing.join(', ')}. Copia .env.example a .env y rellénalas.`
  );
}

module.exports = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildId: process.env.DISCORD_GUILD_ID || null,
  ownerDiscordId: process.env.OWNER_DISCORD_ID || null,
  riotApiKey: process.env.RIOT_API_KEY,
  riotPlatformRegion: process.env.RIOT_PLATFORM_REGION || 'euw1',
  riotContinentRegion: process.env.RIOT_CONTINENT_REGION || 'europe',
  dataFilePath: process.env.DATA_FILE_PATH || './data/users.json',
  guildDataFilePath: process.env.GUILD_DATA_FILE_PATH || './data/guilds.json',
};
