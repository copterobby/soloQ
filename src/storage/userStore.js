const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

let store = { users: {} };
let writeQueue = Promise.resolve();

async function loadStore() {
  try {
    const raw = await fs.readFile(config.dataFilePath, 'utf-8');
    store = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      store = { users: {} };
      await saveStore();
      return;
    }
    throw err;
  }

  let migrated = false;

  // Migración única: el formato antiguo guardaba los usuarios en plano
  // (store.users[discordId]), global para todos los servidores. Los movemos
  // bajo el servidor configurado en DISCORD_GUILD_ID, que es el único en el
  // que corrió el bot antes de que los datos de usuario se aislaran por servidor.
  const legacyEntries = Object.entries(store.users).filter(
    ([, value]) => value && typeof value.puuid === 'string'
  );
  if (legacyEntries.length > 0) {
    if (!config.discordGuildId) {
      console.warn(
        `Se encontraron ${legacyEntries.length} usuario(s) en el formato antiguo (sin servidor asociado), pero DISCORD_GUILD_ID no está configurado. ` +
          'Añade DISCORD_GUILD_ID a tu .env con el ID del servidor donde se vincularon estas cuentas y reinicia el bot para migrarlas.'
      );
    } else {
      store.users[config.discordGuildId] = store.users[config.discordGuildId] || {};
      for (const [discordId, data] of legacyEntries) {
        store.users[config.discordGuildId][discordId] = data;
        delete store.users[discordId];
      }
      migrated = true;
      console.log(`Migrados ${legacyEntries.length} usuario(s) al servidor ${config.discordGuildId}.`);
    }
  }

  // Migración única de registros antiguos: `lastSeenMatchId` (implícitamente cola 420)
  // pasa a vivir dentro de `lastSeenMatchIds`, igual que las demás colas.
  for (const guildUsers of Object.values(store.users)) {
    for (const user of Object.values(guildUsers)) {
      if (user.lastSeenMatchId && !user.lastSeenMatchIds) {
        user.lastSeenMatchIds = { 420: user.lastSeenMatchId };
        delete user.lastSeenMatchId;
        migrated = true;
      }
    }
  }
  if (migrated) await saveStore();
}

function getUser(guildId, discordId) {
  return store.users[guildId]?.[discordId] || null;
}

function getAllUsers(guildId) {
  return Object.entries(store.users[guildId] || {}).map(([discordId, data]) => ({ discordId, ...data }));
}

async function setUser(guildId, discordId, { gameName, tagLine, puuid }) {
  store.users[guildId] = store.users[guildId] || {};
  const existing = store.users[guildId][discordId];
  store.users[guildId][discordId] = {
    gameName,
    tagLine,
    puuid,
    lastSeenMatchIds: {},
    notificationsEnabled: existing?.notificationsEnabled ?? true,
    streaks: {},
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

async function deleteUser(guildId, discordId) {
  if (!store.users[guildId]?.[discordId]) return false;
  delete store.users[guildId][discordId];
  await saveStore();
  return true;
}

function getLastSeenMatchId(user, queueId) {
  return user.lastSeenMatchIds?.[queueId] || null;
}

async function setLastSeenMatchId(guildId, discordId, queueId, matchId) {
  const user = store.users[guildId]?.[discordId];
  if (!user) return;
  user.lastSeenMatchIds = { ...(user.lastSeenMatchIds || {}), [queueId]: matchId };
  user.updatedAt = new Date().toISOString();
  await saveStore();
}

async function setNotificationsEnabled(guildId, discordId, enabled) {
  const user = store.users[guildId]?.[discordId];
  if (!user) return;
  user.notificationsEnabled = enabled;
  user.updatedAt = new Date().toISOString();
  await saveStore();
}

// Racha por cola: un jugador puede estar en racha de victorias en Solo/Duo y
// en racha de derrotas en Flexible al mismo tiempo, son contadores independientes.
// Devuelve la racha *después* de registrar este resultado, ej. { type: 'W', count: 3 }.
async function updateStreak(guildId, discordId, queueId, won) {
  const user = store.users[guildId]?.[discordId];
  if (!user) return { type: won ? 'W' : 'L', count: 1 };

  const streaks = user.streaks || {};
  const current = streaks[queueId] || { type: null, count: 0 };
  const type = won ? 'W' : 'L';
  const count = current.type === type ? current.count + 1 : 1;

  user.streaks = { ...streaks, [queueId]: { type, count } };
  user.updatedAt = new Date().toISOString();
  await saveStore();

  return { type, count };
}

function saveStore() {
  writeQueue = writeQueue.then(async () => {
    const dir = path.dirname(config.dataFilePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${config.dataFilePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tmpPath, config.dataFilePath);
  });
  return writeQueue;
}

module.exports = {
  loadStore,
  getUser,
  getAllUsers,
  setUser,
  deleteUser,
  getLastSeenMatchId,
  setLastSeenMatchId,
  setNotificationsEnabled,
  updateStreak,
};
