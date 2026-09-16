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

  // Migración única de registros antiguos: `lastSeenMatchId` (implícitamente cola 420)
  // pasa a vivir dentro de `lastSeenMatchIds`, igual que las demás colas.
  let migrated = false;
  for (const user of Object.values(store.users)) {
    if (user.lastSeenMatchId && !user.lastSeenMatchIds) {
      user.lastSeenMatchIds = { 420: user.lastSeenMatchId };
      delete user.lastSeenMatchId;
      migrated = true;
    }
  }
  if (migrated) await saveStore();
}

function getUser(discordId) {
  return store.users[discordId] || null;
}

function getAllUsers() {
  return Object.entries(store.users).map(([discordId, data]) => ({ discordId, ...data }));
}

async function setUser(discordId, { gameName, tagLine, puuid }) {
  const existing = store.users[discordId];
  store.users[discordId] = {
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

async function deleteUser(discordId) {
  if (!store.users[discordId]) return false;
  delete store.users[discordId];
  await saveStore();
  return true;
}

function getLastSeenMatchId(user, queueId) {
  return user.lastSeenMatchIds?.[queueId] || null;
}

async function setLastSeenMatchId(discordId, queueId, matchId) {
  const user = store.users[discordId];
  if (!user) return;
  user.lastSeenMatchIds = { ...(user.lastSeenMatchIds || {}), [queueId]: matchId };
  user.updatedAt = new Date().toISOString();
  await saveStore();
}

async function setNotificationsEnabled(discordId, enabled) {
  const user = store.users[discordId];
  if (!user) return;
  user.notificationsEnabled = enabled;
  user.updatedAt = new Date().toISOString();
  await saveStore();
}

// Racha por cola: un jugador puede estar en racha de victorias en Solo/Duo y
// en racha de derrotas en Flexible al mismo tiempo, son contadores independientes.
// Devuelve la racha *después* de registrar este resultado, ej. { type: 'W', count: 3 }.
async function updateStreak(discordId, queueId, won) {
  const user = store.users[discordId];
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
