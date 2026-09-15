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
  store.users[discordId] = {
    gameName,
    tagLine,
    puuid,
    lastSeenMatchId: null,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

async function setLastSeenMatchId(discordId, matchId) {
  if (!store.users[discordId]) return;
  store.users[discordId].lastSeenMatchId = matchId;
  store.users[discordId].updatedAt = new Date().toISOString();
  await saveStore();
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

module.exports = { loadStore, getUser, getAllUsers, setUser, setLastSeenMatchId };
