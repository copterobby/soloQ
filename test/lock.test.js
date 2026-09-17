const test = require('node:test');
const assert = require('node:assert/strict');
const { withLock } = require('../src/util/lock');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('withLock: dos llamadas con la misma key se ejecutan en serie, no solapadas', async () => {
  const events = [];

  const first = withLock('same-key', async () => {
    events.push('first:start');
    await delay(30);
    events.push('first:end');
  });

  const second = withLock('same-key', async () => {
    events.push('second:start');
    await delay(5);
    events.push('second:end');
  });

  await Promise.all([first, second]);

  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('withLock: keys distintas no se bloquean entre sí', async () => {
  const events = [];

  const a = withLock('key-a', async () => {
    events.push('a:start');
    await delay(30);
    events.push('a:end');
  });

  const b = withLock('key-b', async () => {
    events.push('b:start');
    await delay(5);
    events.push('b:end');
  });

  await Promise.all([a, b]);

  // 'b' termina antes que 'a' porque no comparten key, así que no hay serialización.
  assert.deepEqual(events, ['a:start', 'b:start', 'b:end', 'a:end']);
});

test('withLock: devuelve el valor de la función envuelta', async () => {
  const result = await withLock('return-value', async () => 42);
  assert.equal(result, 42);
});
