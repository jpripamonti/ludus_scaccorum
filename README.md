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

### Local run

```bash
npm install
npm start
```

Open:

- http://127.0.0.1:5010

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

### Ejecutar en local

```bash
npm install
npm start
```

Abrir:

- http://127.0.0.1:5010

### Deploy

- El deploy automático a GitHub Pages ya está configurado con GitHub Actions al pushear a `main`.
- Para activarlo, configurar **Settings -> Pages -> Source: GitHub Actions**.

### Licencia

Este repositorio está licenciado bajo **GPL-3.0-or-later**. Ver [LICENSE](./LICENSE).

Nota: el proyecto incluye binarios/artefactos de Stockfish.js/Stockfish bajo términos compatibles con GPL.
