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
    } else {
      throw err;
    }
  }
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
    streakType: null,
    streakCount: 0,
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

// Older records only had a single `lastSeenMatchId` (implicitly ranked solo/duo, queue 420).
function getLastSeenMatchId(user, queueId) {
  const fromNewField = user.lastSeenMatchIds?.[queueId];
  if (fromNewField) return fromNewField;
  if (queueId === 420) return user.lastSeenMatchId || null;
  return null;
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

// Returns the streak *after* recording this result, e.g. { type: 'W', count: 3 }.
async function updateStreak(discordId, won) {
  const user = store.users[discordId];
  if (!user) return { type: won ? 'W' : 'L', count: 1 };

  const type = won ? 'W' : 'L';
  const count = user.streakType === type ? (user.streakCount || 0) + 1 : 1;

  user.streakType = type;
  user.streakCount = count;
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
