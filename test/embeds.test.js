const test = require('node:test');
const assert = require('node:assert/strict');
const { formatRankedEntry, formatDuration, formatNumber } = require('../src/discord/embeds');

test('formatRankedEntry: sin entrada', () => {
  assert.equal(formatRankedEntry(null), 'Sin clasificar');
});

test('formatRankedEntry: tier con división muestra división y LP', () => {
  assert.equal(formatRankedEntry({ tier: 'GOLD', rank: 'II', leaguePoints: 42 }), 'Oro II · 42 LP');
});

test('formatRankedEntry: tiers sin división (Master+) no muestran división', () => {
  assert.equal(formatRankedEntry({ tier: 'CHALLENGER', rank: 'I', leaguePoints: 999 }), 'Retador · 999 LP');
});

test('formatDuration: da formato m:ss con segundos rellenados a dos cifras', () => {
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3599), '59:59');
});

test('formatNumber: números grandes se abrevian en K', () => {
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1500), '1.5K');
});
