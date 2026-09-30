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
- Verified provenance: `vendor/PROVENANCE.md` records what was independently confirmed
  (as of 2026-08-31) about these exact files — the two vendored files were downloaded
  fresh from `nmrugg/stockfish.js` release `v18.0.0` ("Stockfish 18") and are byte-for-byte
  identical to that release's published `stockfish-18-lite-single.js`/`.wasm` assets, whose
  declared upstream Stockfish commit (`cb3d4ee9b47d0c5aae855b12379378ea1439675c`, tagged
  `sf_18`) and required Emscripten version (`3.1.7`) were also confirmed to be real. That
  file also lists what is still open: no from-source rebuild was performed, and there is no
  public CI log for the exact release asset. Read it before assuming more than "verified
  official release asset" has been established.
- Standing offer of source: see the GPLv3 written offer at the end of
  `vendor/PROVENANCE.md`.

Operational requirement: when replacing these files, update `vendor/SHA256SUMS` and `vendor/PROVENANCE.md` with the exact upstream version, source commit or release, build command, and corresponding source archive used to produce the new artifacts.

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

## Fonts (self-hosted)

The interface fonts are served from this site (`assets/fonts/`); no request goes to Google Fonts or any other font provider, so visiting the site discloses nothing to a third party through fonts. Both families are variable fonts in WOFF2 format, restricted to the Latin and Latin Extended subsets (the two "latin" files are precached by the service worker; the "latin-ext" files are only fetched when a glyph outside the Latin range appears). The files are the unmodified WOFF2 subsets distributed by the Fontsource project (`@fontsource-variable/inter` 5.3.0 and `@fontsource-variable/cormorant` 5.3.0 from the npm registry), which repackages the upstream releases.

### Inter

- Files: `assets/fonts/inter-latin-wght.woff2`, `assets/fonts/inter-latin-ext-wght.woff2` (about 48 KB and 85 KB).
- Use: the interface and body text (`--font-ui`, family name "Ludus Sans" in `css/system.css`).
- Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter).
- License: SIL Open Font License, Version 1.1 (https://openfontlicense.org). The Font Software may be used, studied, copied, merged, embedded, modified, redistributed and sold, provided the copyright notice and licence travel with it and that modified versions do not use the Reserved Font Name. The full licence text ships next to the font files as `assets/fonts/OFL-Inter.txt`.

### Cormorant

- Files: `assets/fonts/cormorant-latin-wght.woff2`, `assets/fonts/cormorant-latin-ext-wght.woff2` (about 35 KB and 30 KB).
- Use: titles, the wordmark and large numerals (`--font-display`, family name "Ludus Display" in `css/system.css`).
- Copyright 2015 The Cormorant Project Authors (https://github.com/CatharsisFonts/Cormorant), designed by Christian Thalmann.
- License: SIL Open Font License, Version 1.1 (https://openfontlicense.org), same terms as above. The full licence text ships next to the font files as `assets/fonts/OFL-Cormorant.txt`.

Operational requirement: if the fonts are ever replaced or loaded from a remote provider, update this section first (provider, privacy impact, licence) and the `font-src` directive of the Content-Security-Policy in `index.html`.

## Brand mark and icons

- Files: `assets/brand/logo.svg`, `assets/brand/favicon.svg`, `assets/icons/icon-192.png`, `assets/icons/icon-512.png`, `assets/icons/icon-maskable-512.png`, `assets/icons/apple-touch-icon.png`.
- Origin: an original mark drawn for this project (a rook inside a laurel wreath, built from plain geometric paths); the PNG icons are rendered from the SVG with Chromium. No third-party artwork or font is embedded in these files (the SVGs contain no text).
- License: same as the project (GPL-3.0-or-later).
