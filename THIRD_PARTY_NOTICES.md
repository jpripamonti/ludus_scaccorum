# Third-party notices

This repository is distributed as a static web application. The inventory below records third-party materials that are shipped to users by GitHub Pages.

## Stockfish.js / Stockfish

- Files:
  - `vendor/stockfish-18-lite-single.js`
  - `vendor/stockfish-18-lite-single.wasm`
- Declared upstream in file header: Stockfish.js 18, copyright 2026 Chess.com, LLC.
- Declared upstream repository: `https://github.com/nmrugg/stockfish.js`
- Based on Stockfish: `https://github.com/official-stockfish/Stockfish`
- Declared license in file header: GPLv3.
- Neural network declared in file header: `nn-9067e33176e`, by Linmiao Xu.
- Current checksums are tracked in `vendor/SHA256SUMS`.

Operational requirement: when replacing these files, update `vendor/SHA256SUMS` and record the exact upstream version, source commit or release, build command, and corresponding source archive used to produce the new artifacts.

## Chess piece SVGs

- Files: `assets/pieces/cburnett/*.svg`
- Set name in path: `cburnett`
- License/source: needs confirmation before public redistribution claims are expanded.

Operational requirement: keep these files in the third-party inventory and add exact source URL, license text, and checksums when the source is confirmed.

## Landing artwork

- Files:
  - `assets/landing/maestro.png`
  - `assets/landing/maestro.webp`
- Current sizes:
  - `maestro.png`: approximately 6.9 MB
  - `maestro.webp`: approximately 172 KB
- License/source: needs confirmation before public redistribution claims are expanded.

Operational requirement: prefer the WebP asset in production CSS when browser support allows, and keep source/license metadata with the asset.

## Google Fonts

- Current usage: none. The app uses system font stacks.

Operational requirement: if remote fonts are reintroduced, document the provider and privacy impact here before shipping.
