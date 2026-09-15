const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Encuentra el último momento (en el pasado o ahora mismo) en que cayó el "inicio de semana"
// configurado (día 0-6 estilo Date#getDay, hora 0-23), en la hora local del proceso.
function getMostRecentWeekStart(weekStartDay, weekStartHour, now = new Date()) {
  const result = new Date(now);
  result.setHours(weekStartHour, 0, 0, 0);

  const diffDays = (result.getDay() - weekStartDay + 7) % 7;
  result.setDate(result.getDate() - diffDays);

  if (result.getTime() > now.getTime()) {
    result.setDate(result.getDate() - 7);
  }

  return result;
}

module.exports = { DAY_NAMES, getMostRecentWeekStart };
