const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
require('./testEnv');
const { freshStoreWithTempFile, cleanupDir } = require('./testEnv');

test('userStore: setUser/getUser/getAllUsers/deleteUser aíslan por guild', async () => {
  const { store: userStore, dir } = freshStoreWithTempFile('DATA_FILE_PATH', '../src/storage/userStore');
  try {
    await userStore.loadStore();
    await userStore.setUser('guildA', 'user1', { gameName: 'Foo', tagLine: 'BAR', puuid: 'p1' });

    assert.ok(userStore.getUser('guildA', 'user1'));
    assert.equal(userStore.getUser('guildB', 'user1'), null);
    assert.equal(userStore.getAllUsers('guildA').length, 1);
    assert.equal(userStore.getAllUsers('guildB').length, 0);

    const deleted = await userStore.deleteUser('guildA', 'user1');
    assert.equal(deleted, true);
    assert.equal(userStore.getUser('guildA', 'user1'), null);
  } finally {
    cleanupDir(dir);
  }
});

test('userStore: updateStreak lleva la cuenta por (guild, usuario, cola)', async () => {
  const { store: userStore, dir } = freshStoreWithTempFile('DATA_FILE_PATH', '../src/storage/userStore');
  try {
    await userStore.loadStore();
    await userStore.setUser('g1', 'u1', { gameName: 'Foo', tagLine: 'BAR', puuid: 'p1' });

    let streak = await userStore.updateStreak('g1', 'u1', 420, true);
    assert.deepEqual(streak, { type: 'W', count: 1 });
    streak = await userStore.updateStreak('g1', 'u1', 420, true);
    assert.deepEqual(streak, { type: 'W', count: 2 });
    streak = await userStore.updateStreak('g1', 'u1', 420, false);
    assert.deepEqual(streak, { type: 'L', count: 1 });
  } finally {
    cleanupDir(dir);
  }
});

test('userStore: preserva notificationsEnabled al re-vincular (setUser sobre un usuario existente)', async () => {
  const { store: userStore, dir } = freshStoreWithTempFile('DATA_FILE_PATH', '../src/storage/userStore');
  try {
    await userStore.loadStore();
    await userStore.setUser('g1', 'u1', { gameName: 'Foo', tagLine: 'BAR', puuid: 'p1' });
    await userStore.setNotificationsEnabled('g1', 'u1', false);

    await userStore.setUser('g1', 'u1', { gameName: 'Foo2', tagLine: 'BAR2', puuid: 'p2' });
    const user = userStore.getUser('g1', 'u1');
    assert.equal(user.notificationsEnabled, false);
    assert.equal(user.puuid, 'p2');
  } finally {
    cleanupDir(dir);
  }
});

test('userStore: migra el formato antiguo (plano, sin guild) al guild de DISCORD_GUILD_ID', async () => {
  process.env.DISCORD_GUILD_ID = 'legacy-guild';
  const { store: userStore, dir, filePath } = freshStoreWithTempFile('DATA_FILE_PATH', '../src/storage/userStore');
  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        users: {
          discord1: {
            gameName: 'Foo',
            tagLine: 'BAR',
            puuid: 'p1',
            lastSeenMatchId: 'MATCH1',
            notificationsEnabled: true,
            streaks: {},
            updatedAt: 'x',
          },
        },
      })
    );

    await userStore.loadStore();

    const migrated = userStore.getUser('legacy-guild', 'discord1');
    assert.ok(migrated, 'el usuario debería haberse movido bajo el guild de DISCORD_GUILD_ID');
    assert.equal(migrated.puuid, 'p1');
    // la sub-migración lastSeenMatchId -> lastSeenMatchIds también debe correr después.
    assert.deepEqual(migrated.lastSeenMatchIds, { 420: 'MATCH1' });
    assert.equal(migrated.lastSeenMatchId, undefined);
  } finally {
    process.env.DISCORD_GUILD_ID = '';
    cleanupDir(dir);
  }
});

test('userStore: si hay datos antiguos pero no hay DISCORD_GUILD_ID, no migra ni los pierde', async () => {
  process.env.DISCORD_GUILD_ID = '';
  const { store: userStore, dir, filePath } = freshStoreWithTempFile('DATA_FILE_PATH', '../src/storage/userStore');
  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({
        users: {
          discord1: { gameName: 'Foo', tagLine: 'BAR', puuid: 'p1', notificationsEnabled: true, streaks: {}, updatedAt: 'x' },
        },
      })
    );

    await userStore.loadStore();

    // No se puede saber a qué guild pertenecen sin DISCORD_GUILD_ID, así que no aparecen
    // bajo ningún guild — pero el fichero en disco no debe haberse reescrito perdiendo datos.
    const onDisk = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.ok(onDisk.users.discord1, 'el registro original debe seguir en el fichero');
  } finally {
    cleanupDir(dir);
  }
});
