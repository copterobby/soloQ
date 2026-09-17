const config = require('../config');

// Evita machacar el DM del owner si el mismo problema persiste durante muchos ciclos: como
// mucho un aviso por texto exacto cada COOLDOWN_MS.
const COOLDOWN_MS = 30 * 60 * 1000;
const lastSentAt = new Map();

async function notifyOwner(client, message) {
  if (!config.ownerDiscordId) return;

  const now = Date.now();
  const last = lastSentAt.get(message) || 0;
  if (now - last < COOLDOWN_MS) return;
  lastSentAt.set(message, now);

  try {
    const owner = await client.users.fetch(config.ownerDiscordId);
    await owner.send(message);
  } catch (err) {
    console.error('No se pudo avisar al owner por DM:', err);
  }
}

module.exports = { notifyOwner };
