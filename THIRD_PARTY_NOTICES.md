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
- Author: Colin M.L. Burnett (Wikimedia username `Cburnett`).
- Original source: Wikimedia Commons, e.g. `https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces` and individual files such as `https://commons.wikimedia.org/wiki/File:Chess_klt45.svg` (uploaded 2006-12-27). This is the same widely-used "cburnett" set that lichess.org ships as one of its board piece sets (`https://github.com/lichess-org/lila/tree/master/public/piece/cburnett`); lichess's own `COPYING.md` attributes that set to Colin M.L. Burnett as well (`https://github.com/lichess-org/lila/blob/master/COPYING.md`).
- License: multi-licensed by the original author under any of the following, redistributor's choice — GNU Free Documentation License 1.2 or later, Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0), 3-clause BSD License, or GNU General Public License v2 or later (GPLv2+). (Lichess elects the GPLv2+ option in its own COPYING.md.)
- Required attribution: if redistributed under the CC BY-SA 3.0 or GFDL options, credit is required — e.g. "Chess piece set by Colin M.L. Burnett, CC BY-SA 3.0" with a link to the license. The GPLv2+ and BSD options carry their own standard notice/source-availability terms instead of a CC-style credit line.
- Confidence: high — corroborated independently by the Wikimedia Commons file pages and by lichess.org's own published license file, both of which agree on the author and on GPLv2+ being one of the valid license choices. The local files here are unmodified plain SVGs with the same 45x45 viewBox convention as the canonical set; they carry no embedded metadata of their own, so this confirms the set identity but not a byte-for-byte checksum match.

Operational requirement: keep these files in the third-party inventory. Recommended next step for the project owner: pick one license option from the list above (GPLv2+ matches the project's existing Stockfish GPLv3 dependency) and add a one-line attribution credit for Colin M.L. Burnett somewhere reachable from the UI (e.g. an About/credits section), then record checksums here once that choice is made.

## Landing artwork

- Files:
  - `assets/landing/maestro.png`
  - `assets/landing/maestro.webp`
- Current sizes:
  - `maestro.png`: approximately 6.9 MB
  - `maestro.webp`: approximately 172 KB
- Repository history: both files appear only in this repository's earliest commits (`Init`, 2026-02-25, and `Initial commit`, 2026-03-12) and only ever as newly-added binary files — `git log --all -- assets/landing/maestro.png assets/landing/maestro.webp` shows no later commit touching them, and neither commit message nor any commit in the surrounding history references an external source, stock-image site, or attribution for this image.
- License/source: unresolved. No external source is recorded anywhere in the repository's git history. This is consistent with (but does not prove) the image having been created specifically for Ludus Scaccorum — for instance, generated with an AI image tool for this project — in which case no third-party license would apply. It is equally consistent with the image having been sourced from elsewhere without that source being recorded at the time it was added.
- Action needed from the project owner: confirm which of the two applies. If the image was created specifically for this project (including via an AI generation tool used for this project), state that here and this entry can be closed as "no third-party license applies." If it was sourced from somewhere else (a stock site, another artist, etc.), document that source and its license here before continuing to redistribute it via GitHub Pages.

Operational requirement: prefer the WebP asset in production CSS when browser support allows, and keep source/license metadata with the asset. Do not treat this asset as cleared for redistribution until the project owner resolves the question above.

## Google Fonts

- Current usage: none. The app uses system font stacks.

Operational requirement: if remote fonts are reintroduced, document the provider and privacy impact here before shipping.
