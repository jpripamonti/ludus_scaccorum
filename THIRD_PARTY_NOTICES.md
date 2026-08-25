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

- Files shipped:
  - `assets/landing/maestro.webp` — approximately 170 KB, 2816x1504, used by every browser that supports WebP.
  - `assets/landing/maestro.jpg` — approximately 383 KB, 2816x1504, fallback for browsers without WebP.
- Original: the 7.2 MB PNG the image was delivered as (`assets/landing/maestro.png`, 2816x1504) was removed from the working tree on 2026-08-25 because shipping it cost every first visit roughly 7 MB for a fallback almost no browser used. It remains available in git history at commit `0d44645c730e3bec932b852a9c99c8540d0de8e2` (`git show 0d44645:assets/landing/maestro.png > maestro.png`) and is the source both shipped files were derived from.
- Origin: created for this project. The project owner generated the image with Google Gemini; it was not taken from a stock library, another artist, or any other external source. Confirmed by the project owner on 2026-08-25.
- License/source: no third-party license applies. Google's Generative AI Additional Terms state that Google does not claim ownership of content generated with its consumer AI tools, so redistributing this image as part of Ludus Scaccorum is permitted.
- Caveat worth keeping on record: in several jurisdictions (the United States among them) an image produced entirely by an AI tool, with no substantial human authorship, may not attract copyright protection at all. That does not restrict this project's use of it, but the project should not assume exclusive rights over the image or license it to others as an original work.
- Status: resolved. This asset is cleared for redistribution via GitHub Pages.

Operational requirement: prefer the WebP asset in production CSS when browser support allows, and keep source/license metadata with the asset. If the artwork is ever replaced, record the new origin here before shipping it.

## Google Fonts

- Current usage: none. The app uses system font stacks.

Operational requirement: if remote fonts are reintroduced, document the provider and privacy impact here before shipping.
