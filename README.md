# soloQ bot

Bot de Discord para trackear partidas de League of Legends de tus amigos.

## Comandos

- `/loluser @usuario nombre#tag` — vincula un usuario de Discord con su Riot ID.
- `/leaderboard @usuario` — muestra sus últimas 5 partidas de ranked solo/duo (resultado, campeón, KDA, duración).

## Setup

1. **Discord Developer Portal** (https://discord.com/developers/applications): crea una aplicación, activa los scopes `bot` y `applications.commands`, copia el token y el Client ID. Invita el bot a tu servidor de pruebas.
2. **Riot Developer Portal** (https://developer.riotgames.com): genera una API key de desarrollo (dura 24h, hay que regenerarla cada día mientras pruebas).
3. Copia `.env.example` a `.env` y rellena los valores (`DISCORD_GUILD_ID` es el ID de tu servidor de pruebas, actívalo con el modo desarrollador de Discord para poder copiarlo).
4. Instala dependencias:

```bash
npm install
```

5. Registra los comandos slash (solo hace falta cuando cambian los comandos):

```bash
npm run register-commands
```

6. Arranca el bot:

```bash
npm start
```

## Notas

- Con una API key de desarrollo el rate limit es bajo (20 req/s, 100 req/2min) y caduca cada 24h. Para dejar el bot corriendo de forma permanente hace falta pedir una Production API Key a Riot.
- `data/users.json` guarda el mapeo Discord → Riot ID y no se sube a git.
