const test = require('node:test');
const assert = require('node:assert/strict');
require('./testEnv');
const { freshStoreWithTempFile, cleanupDir } = require('./testEnv');

test('guildStore: valores por defecto cuando no hay configuración', async () => {
  const { store: guildStore, dir } = freshStoreWithTempFile('GUILD_DATA_FILE_PATH', '../src/storage/guildStore');
  try {
    await guildStore.loadStore();

    assert.equal(guildStore.getTrackedChannelId('g1'), null);
    assert.deepEqual(guildStore.getTrackedQueues('g1'), [420]);
    assert.deepEqual(guildStore.getAllTrackedGuilds(), []);
  } finally {
    cleanupDir(dir);
  }
});

test('guildStore: la config de canal y colas se guarda por guild', async () => {
  const { store: guildStore, dir } = freshStoreWithTempFile('GUILD_DATA_FILE_PATH', '../src/storage/guildStore');
  try {
    await guildStore.loadStore();

    await guildStore.setTrackedChannel('g1', 'lol-channel');
    await guildStore.setTrackedQueues('g1', [420, 440]);

    assert.equal(guildStore.getTrackedChannelId('g1'), 'lol-channel');
    assert.deepEqual(guildStore.getTrackedQueues('g1'), [420, 440]);

    assert.deepEqual(guildStore.getAllTrackedGuilds(), [{ guildId: 'g1', channelId: 'lol-channel', trackedQueues: [420, 440] }]);
  } finally {
    cleanupDir(dir);
  }
});

test('guildStore: getAllTrackedGuilds solo incluye guilds con canal configurado', async () => {
  const { store: guildStore, dir } = freshStoreWithTempFile('GUILD_DATA_FILE_PATH', '../src/storage/guildStore');
  try {
    await guildStore.loadStore();
    await guildStore.setTrackedQueues('g1', [420]); // sin canal
    assert.deepEqual(guildStore.getAllTrackedGuilds(), []);

    await guildStore.setTrackedChannel('g1', 'chan');
    assert.equal(guildStore.getAllTrackedGuilds().length, 1);
  } finally {
    cleanupDir(dir);
  }
});

test('guildStore: getLastWeeklySummaryAt/getLastMonthlySummaryAt son independientes', async () => {
  const { store: guildStore, dir } = freshStoreWithTempFile('GUILD_DATA_FILE_PATH', '../src/storage/guildStore');
  try {
    await guildStore.loadStore();
    await guildStore.setTrackedChannel('g1', 'chan');

    assert.equal(guildStore.getLastWeeklySummaryAt('g1'), null);
    assert.equal(guildStore.getLastMonthlySummaryAt('g1'), null);

    await guildStore.setLastWeeklySummaryAt('g1', '2026-01-01T00:00:00.000Z');
    assert.equal(guildStore.getLastWeeklySummaryAt('g1'), '2026-01-01T00:00:00.000Z');
    assert.equal(guildStore.getLastMonthlySummaryAt('g1'), null);

    await guildStore.setLastMonthlySummaryAt('g1', '2026-02-01T00:00:00.000Z');
    assert.equal(guildStore.getLastMonthlySummaryAt('g1'), '2026-02-01T00:00:00.000Z');
  } finally {
    cleanupDir(dir);
  }
});
