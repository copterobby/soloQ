const test = require('node:test');
const assert = require('node:assert/strict');
const { getMostRecentWeekStart } = require('../src/util/weekSchedule');

test('getMostRecentWeekStart: si "ahora" es después de la hora de corte del mismo día, usa hoy', () => {
  // Lunes (1) a las 09:00. "Ahora" es lunes 15:00 -> el inicio de semana es hoy a las 09:00.
  const now = new Date(2026, 0, 5, 15, 0, 0); // 2026-01-05 es lunes
  const result = getMostRecentWeekStart(1, 9, now);
  assert.equal(result.getDate(), 5);
  assert.equal(result.getHours(), 9);
});

test('getMostRecentWeekStart: si "ahora" es antes de la hora de corte del mismo día, retrocede a la semana anterior', () => {
  // Lunes a las 09:00, pero "ahora" es lunes 05:00 -> todavía no ha llegado el corte de hoy.
  const now = new Date(2026, 0, 5, 5, 0, 0);
  const result = getMostRecentWeekStart(1, 9, now);
  assert.equal(result.getDate(), 29); // lunes anterior (2025-12-29)
  assert.equal(result.getMonth(), 11);
});

test('getMostRecentWeekStart: un día distinto al de hoy retrocede al día de la semana correcto', () => {
  // Hoy es lunes 2026-01-05; pedir que la semana empiece en viernes (5) debe dar 2026-01-02.
  const now = new Date(2026, 0, 5, 12, 0, 0);
  const result = getMostRecentWeekStart(5, 9, now);
  assert.equal(result.getDate(), 2);
  assert.equal(result.getDay(), 5);
});
