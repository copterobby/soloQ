# soloQ bot

Bot de Discord para trackear partidas de League of Legends de tus amigos. Funciona en varios servidores a la vez, cada uno con su propio canal y configuración de colas.

## Comandos

- `/loluser @usuario nombre#tag` — vincula un usuario de Discord con su Riot ID.
- `/unlink @usuario` — desvincula una cuenta (cualquiera puede desvincularse a sí mismo; para desvincular a otra persona hace falta el permiso "Gestionar servidor").
- `/games @usuario` — muestra sus últimas 5 partidas de ranked solo/duo (resultado, campeón, KDA, daño, rango, duración), con botones para ver el detalle completo de cada partida (los 10 jugadores).
- `/rank @usuario` — consulta rápida del rango y LP actuales, sin historial de partidas.
- `/leaderboard` — leaderboard real del servidor: compara el rango de todos los vinculados que sean miembros de este servidor.
- `/trackchannel #canal` — configura el canal donde se avisa automáticamente cuando alguien juega (permiso "Gestionar servidor").
- `/trackqueue` — elige qué colas se avisan en este servidor: Solo/Duo, Flexible o ambas (permiso "Gestionar servidor").
- `/notifications on|off` — activa o desactiva tus propios avisos automáticos sin desvincular la cuenta.
- `/syncgames` — revisa y publica las partidas de todos los vinculados que no se hayan avisado todavía (útil tras una caída del bot o de Discord; permiso "Gestionar servidor").
- `/weekconfig` — configura qué día y hora marca el inicio (y fin) de la "semana" para `/weekcount` y el resumen semanal (permiso "Gestionar servidor"; por defecto Lunes 09:00).
- `/weekcount @usuario` — cuenta cuántas partidas ha jugado alguien desde que empezó la semana configurada, con su récord.

Los avisos automáticos incluyen 🌟 aviso de pentakill y 🔥 rachas de 3+ victorias/derrotas seguidas. En el momento configurado con `/weekconfig` (por defecto Lunes 09:00, hora del servidor donde corre el bot) se publica un resumen semanal por servidor con las partidas jugadas y el rango actual de cada vinculado que haya jugado esa semana.

## Setup

1. **Discord Developer Portal** (https://discord.com/developers/applications): crea una aplicación, activa los scopes `bot` y `applications.commands`, copia el token y el Client ID. Invita el bot a tu servidor.
2. **Riot Developer Portal** (https://developer.riotgames.com): genera una API key de desarrollo (dura 24h, hay que regenerarla cada día mientras pruebas).
3. Copia `.env.example` a `.env` y rellena los valores (`DISCORD_GUILD_ID` es opcional, solo para registrar comandos rápido en un servidor de pruebas — déjalo vacío para producción con varios servidores).
4. Instala dependencias:

```bash
npm install
```

5. Registra los comandos slash (solo hace falta cuando cambian los comandos):

```bash
npm run register-commands
```

Para que el bot funcione en **cualquier servidor** donde lo invites (no solo el de `DISCORD_GUILD_ID`), registra los comandos globalmente en su lugar:

```bash
npm run register-commands:global
```

(el registro global tarda hasta 1h en propagarse la primera vez; el de un solo servidor es instantáneo, útil mientras desarrollas)

6. Arranca el bot:

```bash
npm start
```

## Notas

- Con una API key de desarrollo el rate limit es bajo (20 req/s, 100 req/2min) y caduca cada 24h. Para dejar el bot corriendo de forma permanente hace falta pedir una Production API Key a Riot.
- `data/users.json` y `data/guilds.json` guardan el estado del bot y no se suben a git.
- Cada servidor de Discord tiene su propio canal y colas trackeadas; los avisos automáticos solo se publican en los servidores donde el jugador sea miembro.
