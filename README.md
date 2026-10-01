# Ludus Scaccorum

A chess **trainer** for one or two people. You are shown a position, you play the move you think is best, and you are scored by how close your move is to the engine's best move: the closer, the more points; the further, the fewer. Positions come from your own Lichess / Chess.com games (where you actually went wrong), from a library of classic games, from a spaced-repetition notebook of your past mistakes, and from a daily challenge.

Everything runs in your browser. There is no server: Stockfish (WebAssembly) analyses on your device and your progress stays on it.

## Live URL

- https://jpripamonti.github.io/ludus_scaccorum/ (GitHub Pages; needs **Settings -> Pages -> Source: GitHub Actions**)

---

## English

### How you learn here

1. **Play the position.** Find the best move for the side to move, by clicking, dragging (mouse or finger) or with the keyboard.
2. **See how close you were.** You get 0 to 10 points per position from a smooth curve over how much *winning chance* your move gives up compared with the engine's best move. Equivalent moves count as best. Missing a forced mate or allowing one is always a blunder.
3. **Understand why.** A coach panel shows your move against the best one, the engine's top lines (you can step through them on the board), plain-language notes (for example "this piece was left undefended") and links to short lessons.
4. **Come back to it.** Positions you get wrong go into your mistake **notebook** and return on a spaced schedule (1, 3, 7, 14, 30 days) until you find the answer reliably.

### Ways to train

- **Your games**: downloads your public games from Lichess or Chess.com, finds the positions where you erred and lets you replay them.
- **Classic games**: ~29 famous games (Morphy, Anderssen, Capablanca, Fischer, Kasparov, Carlsen...) with a story, an interactive replay and training positions. You play the master's side and are scored against the engine's best move; the master's move and its story are revealed afterwards.
- **Review**: your notebook of past mistakes, scheduled with spaced repetition.
- **Daily challenge**: one classic position per day, with a streak.
- **Duel**: two people share one device, play the same positions and compare points. Who goes first alternates from one position to the next, and each position starts covered until the player who goes first taps, so the other player cannot peek at it beforehand; the first move stays hidden when the device changes hands. Each can use their own local profile.
- **History and curiosities**: a timeline, 100+ short facts and a small chess school of core ideas (fork, pin, zugzwang...). Facts are shown with enough time to read them.

### Configurable

Settings let you choose how the best move is decided and scored: engine strength (fast, balanced, deep), how many engine lines are shown, the scoring model (smooth precision or fixed tiers), strictness, and whether equivalent moves (within a tolerance) or the master's own move also count as best. A live preview shows what each setting does to example moves. You can also choose the board theme, coordinates, animation, sounds and vibration, a clock or no clock, hints, how sensitive mistake detection is for your own games, text size, high contrast and reduced motion. Spanish and English are built in.

### Profiles, progress and sync

- **Local profiles** (up to 4 on a device) hold progress: accuracy trends, levels, streaks, achievements and the notebook. No account is needed. Progress can be exported and imported as a file.
- **Optional Google sign-in** syncs your progress between devices through a hidden file in **your own Google Drive** (no server of ours). It only appears once the site owner enables it: see [`docs/GOOGLE_SIGNIN.md`](docs/GOOGLE_SIGNIN.md). We cannot verify identities without a server, so this is a convenience for syncing, not an access-control system.

### Download policy (own games)

- Lichess priority: `classical` + `rapid`. Chess.com priority: `rapid` + `daily`.
- Fallback chain: `blitz` -> `bullet`. If `bullet` is used, the UI shows a warning because quality is not ideal.
- Only roughly the last year of games is looked at.

### Data and privacy

- Downloads go directly from your browser to Lichess or Chess.com. Before the first download of a session for each provider the app asks you to retype your username as an explicit confirmation.
- The downloaded PGN, your username and metadata are cached in the browser's IndexedDB for 7 days; a "Clear saved game data" button deletes that cache.
- Profiles, settings and the notebook are stored in the browser's `localStorage`. Nothing is sent anywhere else. Google sign-in, if enabled, loads Google's script only when you press the button.
- **Usernames and game links.** When you train with your own Lichess or Chess.com games, every saved round keeps the players' names (your username and your opponent's) and the link to the game, and the session is titled with your username. They live in your local profile and notebook, in the export files you download and, if you turn on Google sync, in the hidden file in your own Google Drive. This app has no server, so none of it is ever sent to us. To remove it: delete the profile or use "Delete all my data" in Account, and clear the downloaded games in Settings > Privacy.

### Browser support

The app needs CSS `:has()` and container queries, so the minimum is **Chrome / Edge 105, Firefox 121, Safari / iOS 16** (older browsers get a short "your browser is too old" notice instead of a broken page). The full Stockfish engine also needs WebAssembly SIMD (Chrome / Edge 91, Firefox 89, **Safari / iOS 16.4**); on anything older the app still works, with a weaker built-in backup engine and a notice saying so. The install / offline mode needs service workers and a secure context (HTTPS or `localhost`); without them the app works online only. Firefox and Safari are reasoned from compatibility data, not tested here.

### Run locally

Requires Node 22.

```bash
npm start            # serves the deploy files on http://127.0.0.1:5010 (loopback only, nothing else of the repository)
npm test             # smoke checks + every unit/integration test (about 30 s)
```

Browser-level checks live in `scripts/e2e/*.js` (Playwright is **not** a dependency; each script explains how to run it, for example `NODE_PATH=$(npm root -g) node scripts/e2e/gate.js`). They are not part of `npm test`.

After editing any deployed file (`js/`, `css/`, `assets/`, `vendor/`, `app.js`, `styles.css`, `config.js`, `manifest.json`, `sw.js` or `index.html` itself, the CSP included), run `node scripts/generate-version.js` (CI fails if the content hash in `index.html`/`sw.js` is stale). The hash is what makes an installed copy notice a new deploy; see section 16 of [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the service worker caches the app and the 7 MB engine.

### Project layout

- `app.js`: the game core (board flow, own-games pipeline, session launcher `Ludus.game`).
- `js/`: modules on the `Ludus` namespace: `chess`, `pgn`, `engine` (UCI, MultiPV), `scoring`, `insights`, `concepts`, `settings`, `profile`, `facts`, `reader`, `audio`, `auth`, `classics`, and `ui/` (kit, shell, screens).
- `data/classics/` + `scripts/build-classics.js`: the classic games and the Stockfish analysis build; see [`docs/CLASSICS_DATA.md`](docs/CLASSICS_DATA.md).
- Design and contracts: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCORING.md`](docs/SCORING.md), [`docs/FACTS_SOURCES.md`](docs/FACTS_SOURCES.md).

### Deployment

Automatic GitHub Pages deployment runs from GitHub Actions on push to `main`: a `build` job with read-only permissions (regenerates the version hash, runs `npm test`, prepares `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.json`, `js/`, `css/`, `assets/`, `vendor/`) and a separate `deploy` job that only publishes that artifact. If the site shares a `*.github.io` origin with other projects, read the "Shared origin" limit in [`docs/GOOGLE_SIGNIN.md`](docs/GOOGLE_SIGNIN.md).

### License

GPL-3.0-or-later, see [LICENSE](./LICENSE). The project bundles Stockfish.js / Stockfish (GPL-3.0) and self-hosted OFL fonts; see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

---

## Español

### Cómo se aprende acá

1. **Jugá la posición.** Encontrá la mejor jugada para el bando que mueve: con clic, arrastrando (mouse o dedo) o con el teclado.
2. **Mirá qué tan cerca estuviste.** Ganás de 0 a 10 puntos por posición según una curva suave de cuánta *probabilidad de ganar* cede tu jugada frente a la mejor del motor. Las jugadas equivalentes cuentan como la mejor. Perder un mate forzado o permitirlo siempre es un error grave.
3. **Entendé por qué.** Un panel de entrenador compara tu jugada con la mejor, muestra las principales variantes del motor (podés recorrerlas en el tablero), notas en lenguaje simple (por ejemplo "esta pieza quedó sin defensa") y enlaces a lecciones cortas.
4. **Volvé a verlo.** Las posiciones que fallás pasan a tu **cuaderno de errores** y vuelven con un calendario espaciado (1, 3, 7, 14, 30 días) hasta que las resolvés con seguridad.

### Formas de entrenar

- **Tus partidas**: descarga tus partidas públicas de Lichess o Chess.com, encuentra las posiciones donde te equivocaste y te deja rejugarlas.
- **Partidas clásicas**: unas 29 partidas famosas (Morphy, Anderssen, Capablanca, Fischer, Kaspárov, Carlsen...) con su historia, repetición interactiva y posiciones de entrenamiento. Jugás del lado del maestro y te puntúa contra la mejor jugada del motor; después se revela la jugada del maestro y su historia.
- **Repaso**: tu cuaderno de errores con repetición espaciada.
- **Desafío diario**: una posición clásica por día, con racha.
- **Duelo**: dos personas comparten el dispositivo, juegan las mismas posiciones y comparan puntos. Quién empieza se alterna de una posición a la siguiente y cada posición arranca tapada hasta que toca quien juega primero, así la otra persona no puede espiarla de antemano; la jugada del primero queda oculta cuando se pasan el dispositivo. Cada una puede usar su perfil local.
- **Historia y curiosidades**: línea de tiempo, más de 100 datos breves y una pequeña escuela de ajedrez (horquilla, clavada, zugzwang...). Los datos se muestran con tiempo suficiente para leerlos.

### Configurable

En Ajustes elegís cómo se decide y se puntúa la mejor jugada: potencia del motor (rápido, equilibrado, profundo), cuántas variantes se muestran, el modelo de puntaje (precisión continua o niveles fijos), la exigencia, y si cuentan como mejores las jugadas equivalentes (dentro de una tolerancia) o también la jugada del maestro. Una vista previa en vivo muestra qué hace cada ajuste con jugadas de ejemplo. También podés elegir tema de tablero, coordenadas, animación, sonidos y vibración, con o sin reloj, pistas, la sensibilidad para detectar errores en tus partidas, tamaño de texto, alto contraste y movimiento reducido. Español e inglés vienen incluidos.

### Perfiles, progreso y sincronización

- Los **perfiles locales** (hasta 4 por dispositivo) guardan el progreso: precisión, niveles, rachas, logros y el cuaderno. No hace falta cuenta. El progreso se puede exportar e importar como archivo.
- El **inicio de sesión con Google** (opcional) sincroniza tu progreso entre dispositivos mediante un archivo oculto en **tu propio Google Drive** (sin servidor nuestro). Solo aparece cuando el dueño del sitio lo habilita: ver [`docs/GOOGLE_SIGNIN.md`](docs/GOOGLE_SIGNIN.md). Sin servidor no podemos verificar identidades: es una comodidad para sincronizar, no un control de acceso.

### Política de descarga (tus partidas)

- Prioridad en Lichess: `classical` + `rapid`. En Chess.com: `rapid` + `daily`.
- Cadena de respaldo: `blitz` -> `bullet`. Si se usa `bullet`, la UI advierte que la calidad no es ideal.
- Sólo se miran, aproximadamente, las partidas del último año.

### Datos y privacidad

- Las descargas van directo de tu navegador a Lichess o Chess.com. Antes de la primera descarga de la sesión para cada proveedor, la app te pide reescribir tu usuario como confirmación explícita.
- El PGN descargado, tu usuario y metadatos se guardan en el IndexedDB del navegador durante 7 días; el botón "Borrar datos guardados de partidas" elimina esa caché.
- Perfiles, ajustes y cuaderno se guardan en el `localStorage` del navegador. No se envía nada a ningún otro lado. Si se habilita el acceso con Google, el script de Google se carga solo cuando tocás el botón.
- **Usuarios y enlaces a partidas.** Si entrenás con tus propias partidas de Lichess o Chess.com, cada ronda guardada conserva los nombres de los jugadores (tu usuario y el de tu rival) y el enlace a la partida, y la sesión lleva tu usuario como título. Quedan en tu perfil y tu cuaderno locales, en los archivos de exportación que descargues y, si activás la sincronización con Google, en el archivo oculto de tu propio Google Drive. Esta app no tiene servidor: nada de esto nos llega. Para borrarlo: eliminá el perfil o usá "Borrar todos mis datos" en Cuenta, y borrá las partidas descargadas en Ajustes > Privacidad.

### Navegadores compatibles

La app necesita CSS `:has()` y container queries, así que el mínimo es **Chrome / Edge 105, Firefox 121, Safari / iOS 16** (los navegadores más viejos ven un aviso breve de "tu navegador es demasiado viejo" en lugar de una página rota). El motor Stockfish completo necesita además WebAssembly SIMD (Chrome / Edge 91, Firefox 89, **Safari / iOS 16.4**); con algo más viejo la app funciona igual, con un motor de respaldo más flojo y un aviso que lo dice. La instalación y el modo sin conexión necesitan service workers y un contexto seguro (HTTPS o `localhost`); sin eso la app funciona solo con conexión. Firefox y Safari están razonados a partir de las tablas de compatibilidad, no probados acá.

### Ejecutar en local

Requiere Node 22.

```bash
npm start            # sirve los archivos del deploy en http://127.0.0.1:5010 (solo en loopback, nada más del repositorio)
npm test             # chequeos de humo + todas las pruebas (unos 30 s)
```

Las pruebas de navegador están en `scripts/e2e/*.js` (Playwright **no** es una dependencia; cada script explica cómo correrlo, por ejemplo `NODE_PATH=$(npm root -g) node scripts/e2e/gate.js`). No forman parte de `npm test`.

Después de editar cualquier archivo que se publica (`js/`, `css/`, `assets/`, `vendor/`, `app.js`, `styles.css`, `config.js`, `manifest.json`, `sw.js` o el propio `index.html`, la CSP incluida), ejecutá `node scripts/generate-version.js` (el CI falla si la huella de contenido en `index.html`/`sw.js` está desactualizada). La huella es lo que hace que una copia instalada note un deploy nuevo; en la sección 16 de [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) está cómo el service worker guarda la app y el motor de 7 MB.

### Estructura del proyecto

- `app.js`: el núcleo del juego (flujo del tablero, pipeline de tus partidas, lanzador de sesiones `Ludus.game`).
- `js/`: módulos sobre el espacio de nombres `Ludus`: `chess`, `pgn`, `engine` (UCI, MultiPV), `scoring`, `insights`, `concepts`, `settings`, `profile`, `facts`, `reader`, `audio`, `auth`, `classics`, y `ui/` (kit, shell, pantallas).
- `data/classics/` + `scripts/build-classics.js`: las partidas clásicas y el análisis con Stockfish; ver [`docs/CLASSICS_DATA.md`](docs/CLASSICS_DATA.md).
- Diseño y contratos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCORING.md`](docs/SCORING.md), [`docs/FACTS_SOURCES.md`](docs/FACTS_SOURCES.md).

### Deploy

El deploy automático a GitHub Pages corre con GitHub Actions al pushear a `main`: un job `build` con permisos de solo lectura (regenera la huella de versión, ejecuta `npm test` y prepara `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.json`, `js/`, `css/`, `assets/`, `vendor/`) y un job `deploy` aparte que solo publica ese artefacto. Si el sitio comparte origen `*.github.io` con otros proyectos, leé el límite "Origen compartido" en [`docs/GOOGLE_SIGNIN.md`](docs/GOOGLE_SIGNIN.md).

### Licencia

GPL-3.0-or-later, ver [LICENSE](./LICENSE). El proyecto incluye Stockfish.js / Stockfish (GPL-3.0) y tipografías autoalojadas con licencia OFL; ver [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
