// Un remake (partida cancelada por desconexión/AFK al inicio) llega de Riot como una partida
// normal con win true/false según el equipo, pero no da ni quita LP ni cuenta como victoria o
// derrota. Riot lo marca con gameEndedInEarlySurrender y dura muy poco (visto en datos reales:
// ~75 s por desconexión durante la carga; el voto manual de remake ocurre hacia los 3-4 min).
//
// El flag por sí solo no basta como criterio: la rendición unánime a los 15 min también es
// "early surrender" pero SÍ cuenta como derrota. Por eso se exige además que la partida sea
// más corta que cualquier rendición real posible.
const REMAKE_MAX_DURATION_SECONDS = 300;

function isRemake(match) {
  const { info } = match;
  if (info.gameDuration >= REMAKE_MAX_DURATION_SECONDS) return false;
  return info.participants.some((p) => p.gameEndedInEarlySurrender);
}

module.exports = { isRemake, REMAKE_MAX_DURATION_SECONDS };
