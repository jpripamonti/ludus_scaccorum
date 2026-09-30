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
- **Classic games**: ~28 famous games (Morphy, Anderssen, Capablanca, Fischer, Kasparov, Carlsen...) with a story, an interactive replay and training positions. You play the master's side and are scored against the engine's best move; the master's move and its story are revealed afterwards.
- **Review**: your notebook of past mistakes, scheduled with spaced repetition.
- **Daily challenge**: one classic position per day, with a streak.
- **Duel**: two people share one device, take turns on the same position and compare points. Each can use their own local profile.
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

### Run locally

Requires Node 22 and Python 3.

```bash
npm start            # serves the static files on http://127.0.0.1:5010
npm test             # smoke checks + every unit/integration test (about 30 s)
```

Browser-level checks live in `scripts/e2e/*.js` (Playwright is **not** a dependency; each script explains how to run it, for example `NODE_PATH=$(npm root -g) node scripts/e2e/gate.js`). They are not part of `npm test`.

After editing any file under `js/`, `css/`, `app.js`, `styles.css` or `config.js`, run `node scripts/generate-version.js` (CI fails if the content hash in `index.html`/`sw.js` is stale).

### Project layout

- `app.js`: the game core (board flow, own-games pipeline, session launcher `Ludus.game`).
- `js/`: modules on the `Ludus` namespace: `chess`, `pgn`, `engine` (UCI, MultiPV), `scoring`, `insights`, `concepts`, `settings`, `profile`, `facts`, `reader`, `audio`, `auth`, `classics`, and `ui/` (kit, shell, screens).
- `data/classics/` + `scripts/build-classics.js`: the classic games and the Stockfish analysis build; see [`docs/CLASSICS_DATA.md`](docs/CLASSICS_DATA.md).
- Design and contracts: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCORING.md`](docs/SCORING.md), [`docs/FACTS_SOURCES.md`](docs/FACTS_SOURCES.md).

### Deployment

Automatic GitHub Pages deployment runs from GitHub Actions on push to `main` (regenerates the version hash, runs `npm test`, publishes `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.json`, `js/`, `css/`, `assets/`, `vendor/`).

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
- **Partidas clásicas**: unas 28 partidas famosas (Morphy, Anderssen, Capablanca, Fischer, Kaspárov, Carlsen...) con su historia, repetición interactiva y posiciones de entrenamiento. Jugás del lado del maestro y te puntúa contra la mejor jugada del motor; después se revela la jugada del maestro y su historia.
- **Repaso**: tu cuaderno de errores con repetición espaciada.
- **Desafío diario**: una posición clásica por día, con racha.
- **Duelo**: dos personas comparten el dispositivo, se turnan en la misma posición y comparan puntos. Cada una puede usar su perfil local.
- **Historia y curiosidades**: línea de tiempo, más de 100 datos breves y una pequeña escuela de ajedrez (horquilla, clavada, zugzwang...). Los datos se muestran con tiempo suficiente para leerlos.

### Configurable

En Ajustes elegís cómo se decide y se puntúa la mejor jugada: potencia del motor (rápido, equilibrado, profundo), cuántas variantes se muestran, el modelo de puntaje (precisión continua o niveles fijos), la exigencia, y si cuentan como mejores las jugadas equivalentes (dentro de una tolerancia) o también la jugada del maestro. Una vista previa en vivo muestra qué hace cada ajuste con jugadas de ejemplo. También podés elegir tema de tablero, coordenadas, animación, sonidos y vibración, con o sin reloj, pistas, la sensibilidad para detectar errores en tus partidas, tamaño de texto, alto contraste y movimiento reducido. Español e inglés vienen incluidos.

### Perfiles, progreso y sincronización

- Los **perfiles locales** (hasta 4 por dispositivo) guardan el progreso: precisión, niveles, rachas, logros y el cuaderno. No hace falta cuenta. El progreso se puede exportar e importar como archivo.
- El **inicio de sesión con Google** (opcional) sincroniza tu progreso entre dispositivos mediante un archivo oculto en **tu propio Google Drive** (sin servidor nuestro). Sólo aparece cuando el dueño del sitio lo habilita: ver [`docs/GOOGLE_SIGNIN.md`](docs/GOOGLE_SIGNIN.md). Sin servidor no podemos verificar identidades: es una comodidad para sincronizar, no un control de acceso.

### Política de descarga (tus partidas)

- Prioridad en Lichess: `classical` + `rapid`. En Chess.com: `rapid` + `daily`.
- Cadena de respaldo: `blitz` -> `bullet`. Si se usa `bullet`, la UI advierte que la calidad no es ideal.
- Sólo se miran, aproximadamente, las partidas del último año.

### Datos y privacidad

- Las descargas van directo de tu navegador a Lichess o Chess.com. Antes de la primera descarga de la sesión para cada proveedor, la app te pide reescribir tu usuario como confirmación explícita.
- El PGN descargado, tu usuario y metadatos se guardan en el IndexedDB del navegador durante 7 días; el botón "Borrar datos guardados de partidas" elimina esa caché.
- Perfiles, ajustes y cuaderno se guardan en el `localStorage` del navegador. No se envía nada a ningún otro lado. Si se habilita el acceso con Google, el script de Google se carga sólo cuando tocás el botón.

### Ejecutar en local

Requiere Node 22 y Python 3.

```bash
npm start            # sirve los archivos estáticos en http://127.0.0.1:5010
npm test             # chequeos de humo + todas las pruebas (unos 30 s)
```

Las pruebas de navegador están en `scripts/e2e/*.js` (Playwright **no** es una dependencia; cada script explica cómo correrlo, por ejemplo `NODE_PATH=$(npm root -g) node scripts/e2e/gate.js`). No forman parte de `npm test`.

Después de editar cualquier archivo de `js/`, `css/`, `app.js`, `styles.css` o `config.js`, ejecutá `node scripts/generate-version.js` (el CI falla si la huella de contenido en `index.html`/`sw.js` está desactualizada).

### Estructura del proyecto

- `app.js`: el núcleo del juego (flujo del tablero, pipeline de tus partidas, lanzador de sesiones `Ludus.game`).
- `js/`: módulos sobre el espacio de nombres `Ludus`: `chess`, `pgn`, `engine` (UCI, MultiPV), `scoring`, `insights`, `concepts`, `settings`, `profile`, `facts`, `reader`, `audio`, `auth`, `classics`, y `ui/` (kit, shell, pantallas).
- `data/classics/` + `scripts/build-classics.js`: las partidas clásicas y el análisis con Stockfish; ver [`docs/CLASSICS_DATA.md`](docs/CLASSICS_DATA.md).
- Diseño y contratos: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCORING.md`](docs/SCORING.md), [`docs/FACTS_SOURCES.md`](docs/FACTS_SOURCES.md).

### Deploy

El deploy automático a GitHub Pages corre con GitHub Actions al pushear a `main` (regenera la huella de versión, ejecuta `npm test` y publica `index.html`, `app.js`, `styles.css`, `config.js`, `sw.js`, `manifest.json`, `js/`, `css/`, `assets/`, `vendor/`).

### Licencia

GPL-3.0-or-later, ver [LICENSE](./LICENSE). El proyecto incluye Stockfish.js / Stockfish (GPL-3.0) y tipografías autoalojadas con licencia OFL; ver [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
