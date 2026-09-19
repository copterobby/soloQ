const test = require('node:test');
const assert = require('node:assert/strict');
const { isRemake } = require('../src/util/remake');
const { buildGameHistoryEmbeds, buildMatchDetailEmbed } = require('../src/discord/embeds');

function participant(overrides = {}) {
  return {
    puuid: 'p-tracked',
    teamId: 100,
    win: false,
    championName: 'Ahri',
    champLevel: 1,
    kills: 0,
    deaths: 0,
    assists: 0,
    totalDamageDealtToChampions: 0,
    totalMinionsKilled: 0,
    neutralMinionsKilled: 0,
    goldEarned: 500,
    visionScore: 0,
    riotIdGameName: 'Foo',
    gameEndedInEarlySurrender: false,
    gameEndedInSurrender: false,
    ...overrides,
  };
}

function match({ duration, win, earlySurrender }) {
  return {
    info: {
      gameDuration: duration,
      gameStartTimestamp: 1_700_000_000_000,
      gameEndTimestamp: 1_700_000_000_000 + duration * 1000,
      gameVersion: '15.19.1',
      participants: [
        participant({ puuid: 'p-tracked', teamId: 100, win, gameEndedInEarlySurrender: earlySurrender }),
        participant({ puuid: 'p-other', teamId: 200, win: !win, gameEndedInEarlySurrender: earlySurrender }),
      ],
    },
  };
}

// Casos reales vistos en la API de Riot: un remake de ~75 s cuenta win:false para un equipo
// y win:true para el otro, con gameEndedInEarlySurrender en todos los participantes.
test('isRemake: remake real perdido (72 s, win false, early surrender)', () => {
  assert.equal(isRemake(match({ duration: 72, win: false, earlySurrender: true })), true);
});

test('isRemake: remake real "ganado" (77 s, win true, early surrender) también es remake', () => {
  assert.equal(isRemake(match({ duration: 77, win: true, earlySurrender: true })), true);
});

test('isRemake: una partida normal no es remake', () => {
  assert.equal(isRemake(match({ duration: 1800, win: true, earlySurrender: false })), false);
});

test('isRemake: una rendición unánime a los 15 min (early surrender, larga) SÍ cuenta como derrota real', () => {
  assert.equal(isRemake(match({ duration: 900, win: false, earlySurrender: true })), false);
});

test('isRemake: una partida corta sin el flag de early surrender no se considera remake', () => {
  assert.equal(isRemake(match({ duration: 200, win: false, earlySurrender: false })), false);
});

test('buildGameHistoryEmbeds: los remakes no entran en el V-D y se avisan aparte', () => {
  const summaries = [
    { win: true, remake: false, championName: 'Ahri', kills: 1, deaths: 1, assists: 1, cs: 100, damageDealt: 1000, visionScore: 5, durationSeconds: 1800, endTimestampSeconds: 1 },
    { win: false, remake: false, championName: 'Ahri', kills: 1, deaths: 1, assists: 1, cs: 100, damageDealt: 1000, visionScore: 5, durationSeconds: 1800, endTimestampSeconds: 1 },
    { win: false, remake: true, championName: 'Ahri', kills: 0, deaths: 0, assists: 0, cs: 0, damageDealt: 0, visionScore: 0, durationSeconds: 72, endTimestampSeconds: 1 },
  ];

  const [header, first, second, third] = buildGameHistoryEmbeds({ gameName: 'Foo', tagLine: 'BAR' }, summaries, null, null);

  assert.match(header.data.description, /\*\*1V - 1D\*\* · 1 remake \(no cuenta\)/);
  assert.match(first.data.title, /Victoria/);
  assert.match(second.data.title, /Derrota/);
  assert.match(third.data.title, /Remake/);
  assert.doesNotMatch(third.data.title, /Derrota/);
});

test('buildMatchDetailEmbed: un remake se titula como remake, no como derrota', () => {
  const embed = buildMatchDetailEmbed(match({ duration: 72, win: false, earlySurrender: true }), 'p-tracked', null);

  assert.match(embed.data.title, /Remake/);
  assert.doesNotMatch(embed.data.title, /Derrota|Victoria/);
  for (const field of embed.data.fields) {
    assert.match(field.name, /Remake/);
  }
});

test('buildMatchDetailEmbed: una derrota normal sigue mostrándose como derrota', () => {
  const embed = buildMatchDetailEmbed(match({ duration: 1800, win: false, earlySurrender: false }), 'p-tracked', null);

  assert.match(embed.data.title, /Derrota/);
});
