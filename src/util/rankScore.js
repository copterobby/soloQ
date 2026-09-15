const TIER_ORDER = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];
const DIVISION_SCORE = { IV: 0, III: 1, II: 2, I: 3 };

function rankScore(entry) {
  if (!entry) return -1;
  const tierIndex = TIER_ORDER.indexOf(entry.tier);
  const divisionIndex = DIVISION_SCORE[entry.rank] ?? 0;
  return tierIndex * 400 + divisionIndex * 100 + entry.leaguePoints;
}

module.exports = { rankScore };
