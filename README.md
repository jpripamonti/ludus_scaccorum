# Ludus Scaccorum

Web-based chess trainer for 1 or 2 players, built around public games from Lichess and Chess.com.

## Live URL

- GitHub Pages URL (once enabled in repository settings):
  - https://jpripamonti.github.io/ludus_scaccorum/

---

## English

### What this project does

- Downloads public games from a selected user (Lichess or Chess.com).
- Extracts candidate mistake positions.
- Lets you play and compares your move against engine best move and game move.
- Supports solo mode and local 2-player duel mode.

### Download policy (current behavior)

- Lichess priority: `classical` + `rapid`.
- Chess.com priority: `rapid` + `daily`.
- Fallback chain: `blitz` -> `bullet`.
- If `bullet` is used, the UI shows a warning because quality is not ideal.

### Data and providers

- Downloads go directly from your browser to Lichess or Chess.com. This app has no backend or proxy server of its own, so nothing passes through a server run by this project.
- Before the first download of a session for each provider, the app asks you to retype your username as an explicit confirmation step.
- The app only looks at roughly the last year of games.
- The downloaded PGN, your username, and related metadata are cached in the browser's IndexedDB for 7 days, and may be reused across sessions for the same provider and username without downloading again.
- If a refresh attempt fails, the app may fall back to a stale cached copy instead of leaving you stuck.
- A stale cached fallback can also end up mixed with `bullet` games as a last-resort source; see "Download policy" above for when `bullet` is used and the warning shown for it.
- A "Clear saved game data" button in the wizard (next to the username field) deletes this local cache; it needs a second tap to confirm.

### Local run

Requires Python 3 (`npm start` serves the static files with `python3 -m http.server`).

```bash
npm install
npm start
```

Open:

- http://127.0.0.1:5010

### Before you push

- Use Node 22 for parity with CI (the GitHub Pages deploy workflow runs on Node 22 and runs `npm test` before publishing).
- Run `npm test` before opening a PR. It runs two checks:
  - `npm run check` (`scripts/smoke-check.js`): confirms required files exist, `app.js`/`sw.js` have no syntax errors, CSS/HTML asset references resolve, no external Google Fonts snuck in, and the Stockfish files match `vendor/SHA256SUMS`.
  - `npm run test:chess` (`scripts/chess-regression-check.js`): runs `app.js` inside a stubbed DOM in a Node `vm` sandbox and checks chess rules (castling, en passant, promotion, checkmate/stalemate), scoring thresholds, download-throttle logic, and the duel/session pipeline.
- Neither test opens a real browser, so neither catches DOM, service-worker, or UI regressions. For anything touching markup, styles, the service worker, or the actual Lichess/Chess.com requests, also check it manually in a browser.

### Deployment

- Automatic GitHub Pages deployment is configured with GitHub Actions on push to `main`.
- To activate it, set **Settings -> Pages -> Source: GitHub Actions**.

### License

This repository is licensed under **GPL-3.0-or-later**. See [LICENSE](./LICENSE).

Note: the project bundles Stockfish.js/Stockfish artifacts under GPL-compatible terms.

---

## Español

### Qué hace este proyecto

- Descarga partidas públicas de un usuario elegido (Lichess o Chess.com).
- Extrae posiciones candidatas con errores.
- Te deja jugar y compara tu jugada contra la mejor del módulo y la jugada de la partida.
- Soporta modo individual y duelo local de 2 jugadores.

### Política de descarga (comportamiento actual)

- Prioridad en Lichess: `classical` + `rapid`.
- Prioridad en Chess.com: `rapid` + `daily`.
- Cadena de fallback: `blitz` -> `bullet`.
- Si se usa `bullet`, la UI muestra advertencia porque la calidad no es ideal.

### Datos y proveedores

- Las descargas van directo desde tu navegador a Lichess o Chess.com. Esta app no tiene servidor propio ni proxy, así que nada pasa por un servidor de este proyecto.
- Antes de la primera descarga de la sesión para cada proveedor, la app te pide reescribir tu usuario como paso explícito de confirmación.
- La app sólo mira, aproximadamente, las partidas del último año.
- El PGN descargado, tu usuario y metadatos relacionados quedan guardados en el IndexedDB del navegador durante 7 días, y se pueden reutilizar entre sesiones para el mismo proveedor y usuario sin volver a descargar.
- Si un intento de actualizar falla, la app puede recurrir a una copia vencida en caché en lugar de dejarte trabado.
- Ese respaldo vencido también puede combinarse con partidas `bullet` como fuente de último recurso; ver "Política de descarga" arriba para cuándo se usa `bullet` y la advertencia que muestra.
- Hay un botón "Borrar datos guardados de partidas" en el asistente (al lado del campo de usuario) que borra esta caché local; pide un segundo toque para confirmar.

### Ejecutar en local

Requiere Python 3 (`npm start` sirve los archivos estáticos con `python3 -m http.server`).

```bash
npm install
npm start
```

Abrir:

- http://127.0.0.1:5010

### Antes de subir cambios

- Usar Node 22 para paridad con CI (el workflow de deploy a GitHub Pages corre en Node 22 y ejecuta `npm test` antes de publicar).
- Correr `npm test` antes de abrir un PR. Ejecuta dos chequeos:
  - `npm run check` (`scripts/smoke-check.js`): confirma que existen los archivos requeridos, que `app.js`/`sw.js` no tienen errores de sintaxis, que las referencias de assets en CSS/HTML resuelven, que no se coló ninguna fuente externa de Google Fonts, y que los archivos de Stockfish coinciden con `vendor/SHA256SUMS`.
  - `npm run test:chess` (`scripts/chess-regression-check.js`): corre `app.js` dentro de un DOM simulado en un sandbox `vm` de Node y revisa reglas de ajedrez (enroque, al paso, promoción, jaque mate/ahogado), umbrales de puntaje, la lógica de límite de descargas, y el pipeline de duelo/sesión.
- Ninguna de las dos pruebas abre un navegador real, así que ninguna detecta regresiones de DOM, service worker o UI. Para cualquier cambio que toque markup, estilos, el service worker, o los pedidos reales a Lichess/Chess.com, conviene además revisarlo a mano en un navegador.

### Deploy

- El deploy automático a GitHub Pages ya está configurado con GitHub Actions al pushear a `main`.
- Para activarlo, configurar **Settings -> Pages -> Source: GitHub Actions**.

### Licencia

Este repositorio está licenciado bajo **GPL-3.0-or-later**. Ver [LICENSE](./LICENSE).

Nota: el proyecto incluye binarios/artefactos de Stockfish.js/Stockfish bajo términos compatibles con GPL.
