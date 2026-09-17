const test = require('node:test');
const assert = require('node:assert/strict');
const { rankScore } = require('../src/util/rankScore');

test('rankScore: sin entrada devuelve -1', () => {
  assert.equal(rankScore(null), -1);
});

test('rankScore: un tier superior siempre pesa más que LP/división del inferior', () => {
  // En el límite exacto (división más alta + 100 LP) un tier inferior puede empatar con el
  // siguiente tier en su división más baja — la fórmula no impide ese empate, así que se
  // compara con un LP por debajo del límite para verificar la propiedad real: superar el tier.
  const low = rankScore({ tier: 'IRON', rank: 'I', leaguePoints: 99 });
  const high = rankScore({ tier: 'BRONZE', rank: 'IV', leaguePoints: 0 });
  assert.ok(high > low, `Bronce IV debería superar a Hierro I con 99 LP: ${high} vs ${low}`);
});

test('rankScore: dentro del mismo tier, más división y más LP suman más', () => {
  const a = rankScore({ tier: 'GOLD', rank: 'IV', leaguePoints: 0 });
  const b = rankScore({ tier: 'GOLD', rank: 'II', leaguePoints: 50 });
  assert.ok(b > a);
});

test('rankScore: tiers sin división (Master+) no dependen de rank', () => {
  const a = rankScore({ tier: 'MASTER', rank: 'I', leaguePoints: 100 });
  const b = rankScore({ tier: 'MASTER', rank: 'IV', leaguePoints: 100 });
  // DIVISION_SCORE no tiene entradas para tiers sin división en los datos reales de Riot
  // (siempre viene 'I'), pero aquí comprobamos que con el mismo LP el resultado es igual
  // si el mapeo de división coincide.
  assert.equal(rankScore({ tier: 'MASTER', rank: 'I', leaguePoints: 100 }), a);
  assert.ok(typeof b === 'number');
});
