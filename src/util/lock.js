// Bloqueo en memoria por clave, suficiente porque el bot corre en un único proceso Node.
// Evita que el tracker automático y /syncgames lean/decidan/escriban el mismo
// (usuario, cola) a la vez y acaben publicando la misma partida dos veces.
const locksInUse = new Set();

async function withLock(key, fn) {
  while (locksInUse.has(key)) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  locksInUse.add(key);
  try {
    return await fn();
  } finally {
    locksInUse.delete(key);
  }
}

module.exports = { withLock };
