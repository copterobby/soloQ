const fs = require('fs/promises');
const path = require('path');
const config = require('../config');

const DEFAULT_TRACKED_QUEUES = [420]; // Ranked Solo/Duo only, unless a server opts into more via /trackqueue
const DEFAULT_WEEK_START_DAY = 1; // Lunes
const DEFAULT_WEEK_START_HOUR = 9;
const DEFAULT_CHALLENGE_START_SECONDS = Math.floor(new Date('2026-09-15T00:00:00').getTime() / 1000);

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

function getGuild(guildId) {
  return store.guilds[guildId] || null;
}

function getTrackedChannelId(guildId) {
  return store.guilds[guildId]?.channelId || null;
}

function getTrackedQueues(guildId) {
  return store.guilds[guildId]?.trackedQueues || DEFAULT_TRACKED_QUEUES;
}

function getAllTrackedGuilds() {
  return Object.entries(store.guilds)
    .filter(([, data]) => data.channelId)
    .map(([guildId, data]) => ({
      guildId,
      channelId: data.channelId,
      trackedQueues: data.trackedQueues || DEFAULT_TRACKED_QUEUES,
    }));
}

async function setTrackedChannel(guildId, channelId) {
  store.guilds[guildId] = {
    ...(store.guilds[guildId] || {}),
    channelId,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

async function setTrackedQueues(guildId, queues) {
  store.guilds[guildId] = {
    ...(store.guilds[guildId] || {}),
    trackedQueues: queues,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

function getWeekSchedule(guildId) {
  const data = store.guilds[guildId];
  return {
    day: data?.weekStartDay ?? DEFAULT_WEEK_START_DAY,
    hour: data?.weekStartHour ?? DEFAULT_WEEK_START_HOUR,
  };
}

async function setWeekSchedule(guildId, day, hour) {
  store.guilds[guildId] = {
    ...(store.guilds[guildId] || {}),
    weekStartDay: day,
    weekStartHour: hour,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

function getChallengeStart(guildId) {
  return store.guilds[guildId]?.challengeStartSeconds ?? DEFAULT_CHALLENGE_START_SECONDS;
}

async function setChallengeStart(guildId, startSeconds) {
  store.guilds[guildId] = {
    ...(store.guilds[guildId] || {}),
    challengeStartSeconds: startSeconds,
    updatedAt: new Date().toISOString(),
  };
  await saveStore();
}

function getLastWeeklySummaryAt(guildId) {
  return store.guilds[guildId]?.lastWeeklySummaryAt || null;
}

async function setLastWeeklySummaryAt(guildId, isoTimestamp) {
  if (!store.guilds[guildId]) return;
  store.guilds[guildId].lastWeeklySummaryAt = isoTimestamp;
  await saveStore();
}

function getLastMonthlySummaryAt(guildId) {
  return store.guilds[guildId]?.lastMonthlySummaryAt || null;
}

async function setLastMonthlySummaryAt(guildId, isoTimestamp) {
  if (!store.guilds[guildId]) return;
  store.guilds[guildId].lastMonthlySummaryAt = isoTimestamp;
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

module.exports = {
  loadStore,
  getGuild,
  getTrackedChannelId,
  getTrackedQueues,
  getAllTrackedGuilds,
  setTrackedChannel,
  setTrackedQueues,
  getWeekSchedule,
  setWeekSchedule,
  getChallengeStart,
  setChallengeStart,
  getLastWeeklySummaryAt,
  setLastWeeklySummaryAt,
  getLastMonthlySummaryAt,
  setLastMonthlySummaryAt,
};
