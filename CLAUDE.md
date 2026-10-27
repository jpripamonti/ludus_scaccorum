# Ludus Scaccorum — agent notes

Browser chess trainer (no server, Stockfish WebAssembly, GitHub Pages). Purpose: learn chess from your own
mistakes and from grandmaster positions, gamified (points, levels, spaced-repetition notebook).
README.md covers features and layout; this file only holds what the code does not tell you.

## Commands

- `npm start`: serves the deploy files on http://127.0.0.1:5010.
- `npm test`: smoke checks plus every unit/integration test; takes about 80 s.
- Browser checks: `NODE_PATH=$(npm root -g) node scripts/e2e/<script>.js` (Playwright is installed globally,
  not a dependency). Not part of `npm test`.
- After editing any deployed file (`js/`, `css/`, `assets/`, `vendor/`, `app.js`, `styles.css`, `config.js`,
  `manifest.json`, `sw.js`, `index.html`) run `node scripts/generate-version.js`, or CI fails on the stale hash.

## Where things live

- Design and contracts: `docs/ARCHITECTURE.md`; scoring: `docs/SCORING.md`; classic games data:
  `docs/CLASSICS_DATA.md`; Google sign-in setup: `docs/GOOGLE_SIGNIN.md`.
- Open work: `PENDING.md`. Known unfixed findings: `docs/KNOWN_ISSUES.md`. Old audit reports: `docs/reports/`.

## Rules

- Solo project: commit straight to `main`. Pushing `main` deploys to GitHub Pages, so push only verified work.
- UI copy is bilingual (es/en): change both languages together.
- Learning from errors: when you find a bug, note it only in `PENDING.md`; then turn it into a test, a code
  validation, or a one-line rule in this file, and delete the note.
