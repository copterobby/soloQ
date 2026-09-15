const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

let store = { guilds: {} };
let writeQueue = Promise.resolve();

async function loadStore() {
  try {
    const raw = await fs.readFile(config.guildDataFilePath, 'utf-8');
    store = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      store = { guilds: {} };
      await saveStore();
    } else {
      throw err;
    }
  }
}

function getTrackedChannelId(guildId) {
  return store.guilds[guildId]?.channelId || null;
}

function getAllTrackedChannels() {
  return Object.entries(store.guilds).map(([guildId, data]) => ({
    guildId,
    channelId: data.channelId,
  }));
}

async function setTrackedChannel(guildId, channelId) {
  store.guilds[guildId] = { channelId, updatedAt: new Date().toISOString() };
  await saveStore();
}

function saveStore() {
  writeQueue = writeQueue.then(async () => {
    const dir = path.dirname(config.guildDataFilePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${config.guildDataFilePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), 'utf-8');
    await fs.rename(tmpPath, config.guildDataFilePath);
  });
  return writeQueue;
}

module.exports = { loadStore, getTrackedChannelId, getAllTrackedChannels, setTrackedChannel };
