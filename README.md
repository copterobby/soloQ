# soloQ bot

Bot de Discord para trackear partidas de League of Legends de tus amigos. Funciona en varios servidores a la vez, cada uno con su propio canal y configuración de colas.

## Comandos — League of Legends

- `/loluser @usuario nombre#tag` — vincula un usuario de Discord con su Riot ID.
- `/unlink @usuario` — desvincula una cuenta (cualquiera puede desvincularse a sí mismo; para desvincular a otra persona hace falta el permiso "Gestionar servidor").
- `/games @usuario` — muestra sus últimas 5 partidas de ranked solo/duo (resultado, campeón, KDA, daño, rango, duración), con botones para ver el detalle completo de cada partida (los 10 jugadores).
- `/rank @usuario` — consulta rápida del rango y LP actuales, sin historial de partidas.
- `/leaderboard` — leaderboard real del servidor: compara el rango de todos los vinculados en este servidor.
- `/trackchannel #canal` — configura el canal donde se avisa automáticamente cuando alguien juega (permiso "Gestionar servidor").
- `/trackqueue` — elige qué colas se avisan en este servidor: Solo/Duo, Flexible o ambas (permiso "Gestionar servidor").
- `/notifications on|off` — activa o desactiva tus propios avisos automáticos sin desvincular la cuenta.
- `/syncgames` — revisa y publica las partidas de todos los vinculados que no se hayan avisado todavía (útil tras una caída del bot o de Discord; permiso "Gestionar servidor").
- `/weekconfig` — configura qué día y hora marca el inicio (y fin) de la "semana" para `/weekcount` y el resumen semanal (permiso "Gestionar servidor"; por defecto Lunes 09:00).
- `/weekcount @usuario` — cuenta cuántas partidas ha jugado alguien desde que empezó la semana configurada, con su récord.

Los avisos automáticos incluyen 🌟 aviso de pentakill y 🔥 rachas de 3+ victorias/derrotas seguidas. En el momento configurado con `/weekconfig` (por defecto Lunes 09:00, hora del servidor donde corre el bot) se publica un resumen semanal por servidor con las partidas jugadas y el rango actual de cada vinculado que haya jugado esa semana.

## Comandos — generales

- `/help` — lista todos los comandos disponibles.
- `/status` — estado del bot: uptime, servidores, vinculados en este servidor y último ciclo de cada tracker/resumen.
- `/setup` — configura de una vez el canal y las colas de League de este servidor (todas las opciones son independientes y opcionales; permiso "Gestionar servidor"). Atajo sobre `/trackchannel` y `/trackqueue` — esos comandos individuales siguen funcionando igual.

Además del resumen semanal, el día 1 de cada mes se publica un resumen mensual de League en el canal trackeado, coronando un MVP (más victorias, con un mínimo de partidas para desempatar por winrate).

Si un tracker (League, resumen semanal o mensual) falla 3 ciclos seguidos, el bot avisa por DM al owner configurado en `OWNER_DISCORD_ID` (opcional; sin él, simplemente no se envía ningún aviso).

## Setup

1. **Discord Developer Portal** (https://discord.com/developers/applications): crea una aplicación, activa los scopes `bot` y `applications.commands`, copia el token y el Client ID. Invita el bot a tu servidor.
2. **Riot Developer Portal** (https://developer.riotgames.com): genera una API key de desarrollo (dura 24h, hay que regenerarla cada día mientras pruebas).
3. Copia `.env.example` a `.env` y rellena los valores (`DISCORD_GUILD_ID` es opcional, solo para registrar comandos rápido en un servidor de pruebas — déjalo vacío para producción con varios servidores; `OWNER_DISCORD_ID` es opcional, tu ID de Discord si quieres recibir un DM cuando algún tracker falle repetidamente).
4. Instala dependencias:

```bash
npm install
```

5. Arranca el bot:

```bash
npm start
```

`npm start` registra los comandos slash **globalmente** antes de arrancar (hook `prestart`, ver `package.json`), así que no hace falta hacerlo a mano ni en cada despliegue — el bot funciona en cualquier servidor donde lo invites. Un fallo puntual al registrar (p. ej. Discord caído) no impide que el bot arranque; simplemente se reintenta en el siguiente despliegue.

Durante desarrollo, si quieres iterar rápido en un solo servidor de pruebas (los cambios de comandos con scope de guild se propagan al instante, frente a hasta 1h en global), pon `DISCORD_GUILD_ID` en tu `.env` y usa:

```bash
npm run register-commands
```

## Tests

```bash
npm test
```

Usa el test runner nativo de Node (`node --test`, sin dependencias nuevas) — cubre solo lógica pura y de storage (rachas, rankings, migraciones de formato, el mutex de `withLock`...), nunca llama a Discord ni a Riot de verdad ni toca `data/*.json`.

## Notas

- Con una API key de desarrollo el rate limit es bajo (20 req/s, 100 req/2min) y caduca cada 24h. Para dejar el bot corriendo de forma permanente hace falta pedir una Production API Key a Riot.
- `data/users.json` y `data/guilds.json` guardan el estado del bot y no se suben a git.
- Cada servidor de Discord tiene su propia configuración (canal, colas trackeadas) y sus propios vínculos de cuenta: un mismo usuario de Discord puede vincular una cuenta distinta en cada servidor con `/loluser`, y `/unlink` solo afecta al servidor donde se ejecuta.
