const test = require('node:test');
const assert = require('node:assert/strict');

// botStatus.js guarda estado en memoria a nivel de módulo (sin fichero), así que cada test
// pide una copia fresca del módulo para no compartir contadores entre tests.
function freshBotStatus() {
  delete require.cache[require.resolve('../src/botStatus')];
  return require('../src/botStatus');
}

test('botStatus: un ciclo ok resetea la racha de fallos', () => {
  const botStatus = freshBotStatus();
  botStatus.recordCycle('lol', { ok: false, error: new Error('boom') });
  botStatus.recordCycle('lol', { ok: true });

  const status = botStatus.getStatus();
  assert.equal(status.lol.consecutiveFailures, 0);
  assert.equal(status.lol.lastError, null);
});

test('botStatus: avisa exactamente al llegar al umbral, no antes ni después', () => {
  const botStatus = freshBotStatus();
  const err = new Error('boom');
  const results = [];
  for (let i = 0; i < 5; i += 1) {
    results.push(botStatus.recordCycle('lol', { ok: false, error: err }));
  }

  // FAILURE_ALERT_THRESHOLD = 3: solo el tercer ciclo consecutivo debe devolver true.
  assert.deepEqual(results, [false, false, true, false, false]);
  assert.equal(botStatus.getStatus().lol.consecutiveFailures, 5);
});

test('botStatus: rachas de fallos de trackers distintos son independientes', () => {
  const botStatus = freshBotStatus();
  botStatus.recordCycle('lol', { ok: false, error: new Error('x') });
  botStatus.recordCycle('lol', { ok: false, error: new Error('x') });
  botStatus.recordCycle('weeklySummary', { ok: false, error: new Error('y') });

  const status = botStatus.getStatus();
  assert.equal(status.lol.consecutiveFailures, 2);
  assert.equal(status.weeklySummary.consecutiveFailures, 1);
});
