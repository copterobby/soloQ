const fs = require('fs');
const os = require('os');
const path = require('path');

// src/config.js llama a `dotenv.config()` cada vez que se re-requiere (ver
// freshStoreWithTempFile más abajo), y dotenv rellena cualquier variable que no esté ya
// puesta con el valor del `.env` real del proyecto — incluido borrarla con `delete` no
// evita que vuelva, porque dotenv la ve "no puesta" otra vez. Por eso aquí se fijan TODAS
// las variables que config.js puede leer, con `=` (no `||=`), antes de que nada pueda
// requerir config.js por primera vez: así dotenv nunca llega a inyectar secretos reales
// (guild ID, token, API key...) en el proceso de test.
process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.RIOT_API_KEY = 'test-riot-key';
process.env.DISCORD_GUILD_ID = '';
process.env.OWNER_DISCORD_ID = '';
process.env.RIOT_PLATFORM_REGION = 'euw1';
process.env.RIOT_CONTINENT_REGION = 'europe';

// Cada test que toque un store debe pedir su propia carpeta temporal y apuntar el env var
// correspondiente ahí ANTES de requerir src/config.js o el store — nunca usar data/*.json real.
function makeTempDataDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `soloq-${prefix}-`));
}

function cleanupDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// src/config.js lee las variables de entorno una sola vez, al cargarse, y los stores guardan
// una referencia a ese objeto config ya cargado. Para poder aislar cada test con su propio
// fichero temporal hay que invalidar la caché de require de config.js Y del store antes de
// volver a requerirlo, para que ambos se re-evalúen leyendo el env var ya actualizado.
function freshStoreWithTempFile(envVarName, storeModulePath) {
  const dir = makeTempDataDir('store');
  const filePath = path.join(dir, 'data.json');
  process.env[envVarName] = filePath;

  delete require.cache[require.resolve('../src/config')];
  delete require.cache[require.resolve(storeModulePath)];
  const store = require(storeModulePath);

  return { store, dir, filePath };
}

module.exports = { makeTempDataDir, cleanupDir, freshStoreWithTempFile };
