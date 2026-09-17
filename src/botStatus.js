// Estado en memoria de los ciclos periódicos (tracker de LoL, resúmenes), para el
// comando /status y para detectar fallos repetidos. No se persiste a disco a propósito: es
// un panel de diagnóstico, no datos de negocio, y resetearlo con cada arranque es lo correcto.
const FAILURE_ALERT_THRESHOLD = 3;

const trackers = {};

function getTracker(key) {
  if (!trackers[key]) {
    trackers[key] = {
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      consecutiveFailures: 0,
      alertedAt: null,
    };
  }
  return trackers[key];
}

// Llamado al final de cada ciclo de un tracker. Devuelve true la primera vez que la racha de
// fallos consecutivos alcanza el umbral (para que el llamador decida avisar al owner una sola
// vez, no en cada ciclo mientras el problema persiste).
function recordCycle(key, { ok, error } = {}) {
  const tracker = getTracker(key);
  tracker.lastRunAt = new Date().toISOString();

  if (ok) {
    tracker.lastSuccessAt = tracker.lastRunAt;
    tracker.lastError = null;
    tracker.consecutiveFailures = 0;
    tracker.alertedAt = null;
    return false;
  }

  tracker.lastError = error ? String(error.message || error) : 'Error desconocido';
  tracker.consecutiveFailures += 1;

  const shouldAlert = tracker.consecutiveFailures === FAILURE_ALERT_THRESHOLD;
  return shouldAlert;
}

function getStatus() {
  return { ...trackers };
}

module.exports = { recordCycle, getStatus, FAILURE_ALERT_THRESHOLD };
